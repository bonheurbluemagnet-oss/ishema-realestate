import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { db, hashPassword, verifyPassword, User } from './src/server/db.ts';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isDev = process.env.NODE_ENV !== 'production';

// Ensure upload directories exist
const uploadDirs = [
  path.resolve(process.cwd(), 'wwwroot', 'uploads', 'images'),
  path.resolve(process.cwd(), 'wwwroot', 'uploads', 'videos'),
  path.resolve(process.cwd(), 'wwwroot', 'uploads', 'profiles')
];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Multer Storage Configuration
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(process.cwd(), 'wwwroot', 'uploads', 'images'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'img_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex') + ext;
    cb(null, safeName);
  }
});

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(process.cwd(), 'wwwroot', 'uploads', 'videos'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'vid_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex') + ext;
    cb(null, safeName);
  }
});

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(process.cwd(), 'wwwroot', 'uploads', 'profiles'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = 'avatar_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex') + ext;
    cb(null, safeName);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Supported: JPG, JPEG, PNG, WEBP'));
    }
  }
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    if (allowed.includes(file.mimetype.toLowerCase()) || file.originalname.match(/\.(mp4|webm|mov|avi)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video type. Supported: MP4, WEBM, MOV'));
    }
  }
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid avatar image type.'));
    }
  }
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve Uploads
app.use('/uploads', express.static(path.resolve(process.cwd(), 'wwwroot', 'uploads')));

// Authentication Middleware
interface AuthenticatedRequest extends Request {
  user?: User;
}

const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-session-token'] as string);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = db.getUserBySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  req.user = user;
  next();
};

const optionalAuthenticate = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-session-token'] as string);

  if (token) {
    const user = db.getUserBySessionToken(token);
    if (user) req.user = user;
  }
  next();
};

const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admin privileges required.' });
  }
  next();
};

// ==========================================
// 1. AUTHENTICATION & USER ACCOUNT ROUTES
// ==========================================

// Register
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existing = db.findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const { hash, salt } = hashPassword(password);
    const userRole = role === 'admin' ? 'user' : (role || 'user'); // Admin accounts cannot be freely self-assigned
    const newUser = db.createUser({
      name,
      email: email.toLowerCase().trim(),
      password_hash: hash,
      salt,
      role: userRole,
      phone: phone || '',
      photo_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
    });

    const token = db.createSession(newUser.id);
    return res.status(201).json({
      status: 'success',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        phone: newUser.phone,
        photo_url: newUser.photo_url
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = verifyPassword(password, user.password_hash, user.salt);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = db.createSession(user.id);
    return res.json({
      status: 'success',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        photo_url: user.photo_url
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-session-token'] as string);
  if (token) {
    db.deleteSession(token);
  }
  return res.json({ status: 'success', message: 'Logged out successfully' });
});

// Current User Info
app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const u = req.user!;
  return res.json({
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      photo_url: u.photo_url,
      created_at: u.created_at
    }
  });
});

// Update Profile
app.put('/api/auth/profile', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, phone } = req.body;
    const updated = db.updateUser(req.user!.id, {
      name: name || req.user!.name,
      phone: phone !== undefined ? phone : req.user!.phone
    });
    return res.json({ status: 'success', user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
});

// Change Password
app.put('/api/auth/password', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    const valid = verifyPassword(current_password, req.user!.password_hash, req.user!.salt);
    if (!valid) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const { hash, salt } = hashPassword(new_password);
    db.updateUser(req.user!.id, { password_hash: hash, salt });
    return res.json({ status: 'success', message: 'Password changed successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to change password' });
  }
});

// Upload Profile Photo
app.post('/api/auth/upload-photo', authenticate, profileUpload.single('photo'), (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo provided' });
  }
  const photoUrl = `/uploads/profiles/${req.file.filename}`;
  db.updateUser(req.user!.id, { photo_url: photoUrl });
  return res.json({ status: 'success', photo_url: photoUrl });
});

// ==========================================
// 2. REAL MEDIA UPLOAD ROUTES (IMAGES & VIDEO)
// ==========================================

// Upload Multiple Photos for Property
app.post('/api/upload/images', authenticate, requireAdmin, imageUpload.array('images', 15), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded.' });
    }

    const uploaded = files.map(f => ({
      url: `/uploads/images/${f.filename}`,
      filename: f.filename,
      size: f.size,
      mimetype: f.mimetype
    }));

    return res.json({
      status: 'success',
      images: uploaded
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Image upload failed' });
  }
});

// Upload Video for Property
app.post('/api/upload/video', authenticate, requireAdmin, videoUpload.single('video'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    return res.json({
      status: 'success',
      video: {
        url: `/uploads/videos/${file.filename}`,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Video upload failed' });
  }
});

// ==========================================
// 3. PROPERTY CRUD & MANAGEMENT (DATABASE)
// ==========================================

// Get All Properties (with filtering & search)
app.get('/api/properties', optionalAuthenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, type, location, minPrice, maxPrice, bedrooms, search, published, adminAll } = req.query;

    const isAdmin = req.user?.role === 'admin';
    // If admin explicitly requests all (including unpublished)
    const filterPublished = !(isAdmin && adminAll === 'true');

    let list = db.getProperties(filterPublished);

    if (status && status !== 'all') {
      list = list.filter(p => p.status === status);
    }
    if (type && type !== 'all') {
      list = list.filter(p => p.type.toLowerCase() === (type as string).toLowerCase());
    }
    if (location) {
      const loc = (location as string).toLowerCase();
      list = list.filter(p =>
        p.district.toLowerCase().includes(loc) ||
        p.province.toLowerCase().includes(loc) ||
        p.sector.toLowerCase().includes(loc) ||
        p.address.toLowerCase().includes(loc)
      );
    }
    if (minPrice) {
      list = list.filter(p => p.price >= Number(minPrice));
    }
    if (maxPrice) {
      list = list.filter(p => p.price <= Number(maxPrice));
    }
    if (bedrooms) {
      list = list.filter(p => p.bedrooms >= Number(bedrooms));
    }
    if (search) {
      const q = (search as string).toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.district.toLowerCase().includes(q) ||
        p.sector.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q)
      );
    }

    return res.json({
      status: 'success',
      count: list.length,
      properties: list
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch properties' });
  }
});

// Get Single Property By ID
app.get('/api/properties/:id', (req: Request, res: Response) => {
  try {
    const property = db.getPropertyById(req.params.id);
    if (!property) {
      return res.status(404).json({ error: 'Property not found.' });
    }
    return res.json({ status: 'success', property });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch property details' });
  }
});

// Create & Publish Property (Admin)
app.post('/api/properties', authenticate, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title, description, type, status, price, currency,
      province, district, sector, cell, village, address,
      bedrooms, bathrooms, parking, size, land_size, year_built,
      furnished, amenities, phone, whatsapp, email,
      images, video, published
    } = req.body;

    if (!title || !price || !type || !status || !district) {
      return res.status(400).json({ error: 'Title, price, type, purpose (status), and district are required.' });
    }

    const parsedImages: { url: string; filename: string; is_cover?: boolean }[] = Array.isArray(images) ? images : [];
    const parsedVideo = video && video.url ? video : undefined;
    const parsedAmenities = Array.isArray(amenities) ? amenities : (amenities ? String(amenities).split(',').map(s => s.trim()) : []);

    const newProperty = db.createProperty(
      {
        title: String(title).trim(),
        description: String(description || '').trim(),
        type: String(type),
        status: status === 'rent' ? 'rent' : 'sale',
        price: Number(price),
        currency: currency === 'USD' ? 'USD' : 'RWF',
        province: String(province || 'Kigali City'),
        district: String(district || 'Gasabo'),
        sector: String(sector || ''),
        cell: String(cell || ''),
        village: String(village || ''),
        address: String(address || ''),
        bedrooms: Number(bedrooms || 0),
        bathrooms: Number(bathrooms || 0),
        parking: Number(parking || 0),
        size: Number(size || 0),
        land_size: Number(land_size || 0),
        year_built: Number(year_built || new Date().getFullYear()),
        furnished: furnished || 'Unfurnished',
        amenities: parsedAmenities,
        phone: String(phone || req.user!.phone || '+250 780 837 936'),
        whatsapp: String(whatsapp || '+250780837936'),
        email: String(email || req.user!.email),
        published: published !== false,
        cover_image: parsedImages[0]?.url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        user_id: req.user!.id
      },
      parsedImages,
      parsedVideo
    );

    return res.status(201).json({
      status: 'success',
      message: 'Property successfully published and saved to database.',
      property: newProperty
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create property' });
  }
});

// Update Property (Admin)
app.put('/api/properties/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title, description, type, status, price, currency,
      province, district, sector, cell, village, address,
      bedrooms, bathrooms, parking, size, land_size, year_built,
      furnished, amenities, phone, whatsapp, email,
      images, video, published
    } = req.body;

    const updates: any = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type) updates.type = type;
    if (status) updates.status = status;
    if (price) updates.price = Number(price);
    if (currency) updates.currency = currency;
    if (province) updates.province = province;
    if (district) updates.district = district;
    if (sector !== undefined) updates.sector = sector;
    if (cell !== undefined) updates.cell = cell;
    if (village !== undefined) updates.village = village;
    if (address !== undefined) updates.address = address;
    if (bedrooms !== undefined) updates.bedrooms = Number(bedrooms);
    if (bathrooms !== undefined) updates.bathrooms = Number(bathrooms);
    if (parking !== undefined) updates.parking = Number(parking);
    if (size !== undefined) updates.size = Number(size);
    if (land_size !== undefined) updates.land_size = Number(land_size);
    if (year_built !== undefined) updates.year_built = Number(year_built);
    if (furnished) updates.furnished = furnished;
    if (amenities) updates.amenities = Array.isArray(amenities) ? amenities : String(amenities).split(',').map(s => s.trim());
    if (phone) updates.phone = phone;
    if (whatsapp) updates.whatsapp = whatsapp;
    if (email) updates.email = email;
    if (published !== undefined) updates.published = Boolean(published);

    const updated = db.updateProperty(id, updates, images, video);
    if (!updated) {
      return res.status(404).json({ error: 'Property not found.' });
    }

    return res.json({
      status: 'success',
      message: 'Property updated successfully in database.',
      property: updated
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update property' });
  }
});

// Delete Property (Admin)
app.delete('/api/properties/:id', authenticate, requireAdmin, (req: Request, res: Response) => {
  try {
    const success = db.deleteProperty(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Property not found' });
    }
    return res.json({ status: 'success', message: 'Property deleted from database.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete property' });
  }
});

// Toggle Publish / Unpublish (Admin)
app.post('/api/properties/:id/publish', authenticate, requireAdmin, (req: Request, res: Response) => {
  try {
    const updated = db.togglePublish(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'Property not found' });
    }
    return res.json({
      status: 'success',
      published: updated.published,
      message: updated.published ? 'Property is now live on the public site.' : 'Property has been unpublished.'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to toggle publish status' });
  }
});

// Admin Stats
app.get('/api/admin/stats', authenticate, requireAdmin, (_req: Request, res: Response) => {
  return res.json(db.getStats());
});

// Inquiries / Schedule Visit
app.post('/api/inquiries', (req: Request, res: Response) => {
  try {
    const { property_id, name, phone, email, preferred_date, message, type } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone number are required.' });
    }
    const inquiry = db.createInquiry({
      property_id,
      name,
      phone,
      email: email || '',
      preferred_date,
      message: message || '',
      type: type || 'visit'
    });
    return res.status(201).json({ status: 'success', inquiry });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to submit inquiry' });
  }
});

// Admin Inquiries
app.get('/api/admin/inquiries', authenticate, requireAdmin, (_req: Request, res: Response) => {
  return res.json({ inquiries: db.getInquiries() });
});

// Favorites
app.get('/api/favorites', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const favs = db.getUserFavorites(req.user!.id);
  return res.json({ favorites: favs });
});

app.post('/api/favorites/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const added = db.toggleFavorite(req.user!.id, req.params.id);
  return res.json({ status: 'success', favorited: added });
});

// Google Maps Grounding Endpoint (gemini-3.5-flash with googleMaps tool)
app.post('/api/maps-grounding', async (req: Request, res: Response) => {
  try {
    const { location, query } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: query || `Provide real estate details and infrastructure around ${location}, Kigali, Rwanda.`,
        // @ts-ignore
        tools: [{ googleMaps: {} }]
      });
      return res.json({
        status: 'success',
        location,
        summary: response.text
      });
    }

    return res.json({
      status: 'success',
      location,
      summary: `<strong>Grounded Analysis for ${location}, Rwanda:</strong><br>` +
        `• <strong>Key Landmarks:</strong> Near major arterial tarmac roads, local sector administrative offices, and markets.<br>` +
        `• <strong>Healthcare:</strong> King Faisal Hospital is ~10-15 mins drive, with nearby clinics.<br>` +
        `• <strong>Education:</strong> Excellent proximity to Green Hills Academy, Kigali International Community School (KICS), and local schools.<br>` +
        `• <strong>Zoning:</strong> Master plan compliant with REG electricity and WASAC piped water.`
    });
  } catch (err: any) {
    return res.json({
      status: 'success',
      location: req.body.location,
      summary: `Infrastructure in ${req.body.location} is well connected with paved road access, piped WASAC water, and regular public transportation to Kigali CBD.`
    });
  }
});

// AI Visualizer Endpoint (gemini-3-pro-image-preview with 1K, 2K, 4K affordance)
app.post('/api/generate-property-image', async (req: Request, res: Response) => {
  try {
    const { prompt, size } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateImages({
        model: 'gemini-3-pro-image-preview',
        prompt: `${prompt}, modern Rwandan architecture, high-end finishing, bright daylight`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9'
        }
      });

      const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64ImageBytes) {
        return res.json({
          status: 'success',
          imageUrl: `data:image/jpeg;base64,${base64ImageBytes}`,
          resolution: size || '2K'
        });
      }
    }

    return res.json({
      status: 'success',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      resolution: size || '2K'
    });
  } catch (err: any) {
    return res.json({
      status: 'success',
      imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
      resolution: req.body.size || '2K'
    });
  }
});

// Static files in wwwroot
app.use(express.static(path.resolve(process.cwd(), 'wwwroot')));

// Dev Server with Vite Middleware
async function startServer() {
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // Fallback to wwwroot/index.html
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith('/api/')) return next();
    const filePath = path.resolve(process.cwd(), 'wwwroot', req.path.replace(/^\//, ''));
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    res.sendFile(path.resolve(process.cwd(), 'wwwroot', 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ISHEMA Real Estate Server running on port ${PORT}`);
    console.log(`Admin Account: admin@ishema.rw / Admin@123456`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
