import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  salt: string;
  role: 'admin' | 'user' | 'agent';
  phone?: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  filename: string;
  is_cover: boolean;
  order: number;
  created_at: string;
}

export interface PropertyVideo {
  id: string;
  property_id: string;
  url: string;
  filename: string;
  created_at: string;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'sale' | 'rent';
  price: number;
  currency: 'RWF' | 'USD';
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  size: number;
  land_size: number;
  year_built: number;
  furnished: 'Furnished' | 'Semi-Furnished' | 'Unfurnished';
  amenities: string[];
  phone: string;
  whatsapp: string;
  email: string;
  published: boolean;
  cover_image: string;
  user_id: string;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}

export interface Inquiry {
  id: string;
  property_id?: string;
  user_id?: string;
  name: string;
  phone: string;
  email: string;
  preferred_date?: string;
  message: string;
  type: string;
  status: 'pending' | 'contacted' | 'resolved';
  created_at: string;
}

interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  properties: Property[];
  property_images: PropertyImage[];
  property_videos: PropertyVideo[];
  favorites: Favorite[];
  inquiries: Inquiry[];
}

const DB_FILE = path.resolve(process.cwd(), 'data', 'ishema.db.json');

// Ensure data directory exists
const dataDir = path.dirname(DB_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const userSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, userSalt, 64).toString('hex');
  return { hash, salt: userSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calculated, 'hex'));
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.load();
    this.seedDefaults();
  }

  private load(): DatabaseSchema {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (err) {
        console.error('Failed to parse database file, initializing empty schema:', err);
      }
    }
    return {
      users: [],
      sessions: [],
      properties: [],
      property_images: [],
      property_videos: [],
      favorites: [],
      inquiries: []
    };
  }

  public save() {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  private seedDefaults() {
    let modified = false;

    // Seed Admin Account if not exists
    const adminExists = this.data.users.find(u => u.role === 'admin' || u.email === 'admin@ishema.rw');
    if (!adminExists) {
      const { hash, salt } = hashPassword('Admin@123456');
      const adminUser: User = {
        id: 'usr_admin_' + crypto.randomUUID().slice(0, 8),
        name: 'Ishema Administrator',
        email: 'admin@ishema.rw',
        password_hash: hash,
        salt,
        role: 'admin',
        phone: '+250 780 837 936',
        photo_url: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.users.push(adminUser);
      modified = true;
      console.log('Seeded Admin account: admin@ishema.rw / Admin@123456');
    }

    // Seed Demo User Account if not exists
    const userExists = this.data.users.find(u => u.email === 'user@ishema.rw');
    if (!userExists) {
      const { hash, salt } = hashPassword('User@123456');
      const standardUser: User = {
        id: 'usr_buyer_' + crypto.randomUUID().slice(0, 8),
        name: 'Jean-Luc Habimana',
        email: 'user@ishema.rw',
        password_hash: hash,
        salt,
        role: 'user',
        phone: '+250 788 987 654',
        photo_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.data.users.push(standardUser);
      modified = true;
    }

    // Seed initial Rwanda properties if database has zero properties
    if (this.data.properties.length === 0) {
      const adminId = this.data.users.find(u => u.role === 'admin')?.id || 'usr_admin';
      const initialProps: Omit<Property, 'created_at' | 'updated_at'>[] = [
        {
          id: 'prop_nyarutarama_villa',
          title: 'Luxury 5-Bedroom Villa with Swimming Pool in Nyarutarama',
          description: 'Magnificent executive residence situated in prime Nyarutarama near the Golf Club. Features high-ceiling living rooms, imported European kitchen fixtures, private swimming pool, staff quarters, and manicured lush tropical gardens.',
          type: 'House',
          status: 'sale',
          price: 380000000,
          currency: 'RWF',
          province: 'Kigali City',
          district: 'Gasabo',
          sector: 'Remera',
          cell: 'Nyarutarama',
          village: 'Kangondo',
          address: 'KG 9 Ave, Nyarutarama Golf Vicinity',
          bedrooms: 5,
          bathrooms: 5,
          parking: 4,
          size: 520,
          land_size: 850,
          year_built: 2023,
          furnished: 'Furnished',
          amenities: ['Swimming Pool', 'Solar Water Heater', 'Water Tank (10,000L)', 'CCTV Security', 'Paved Access', 'Garden', 'Standby Generator'],
          phone: '+250 780 837 936',
          whatsapp: '+250780837936',
          email: 'admin@ishema.rw',
          published: true,
          cover_image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
          user_id: adminId,
          views: 1420
        },
        {
          id: 'prop_gacuriro_home',
          title: 'Modern Contemporary Family Home in Gacuriro',
          description: 'Brand new contemporary 4-bedroom house with panoramic hill views. Includes open-plan layout, porcelain tiles, rooftop terrace, water treatment system, and electric fence.',
          type: 'House',
          status: 'sale',
          price: 185000000,
          currency: 'RWF',
          province: 'Kigali City',
          district: 'Gasabo',
          sector: 'Kinyinya',
          cell: 'Gacuriro',
          village: 'Vision City Area',
          address: 'KG 14 Ave, Gacuriro',
          bedrooms: 4,
          bathrooms: 4,
          parking: 3,
          size: 340,
          land_size: 450,
          year_built: 2024,
          furnished: 'Semi-Furnished',
          amenities: ['Rooftop Terrace', 'Paved Road', 'Water Storage', 'Security Fence', 'Balcony', 'Modern Kitchen'],
          phone: '+250 780 837 936',
          whatsapp: '+250780837936',
          email: 'admin@ishema.rw',
          published: true,
          cover_image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80',
          user_id: adminId,
          views: 980
        },
        {
          id: 'prop_kibagabaga_rental',
          title: 'Charming 4-Bedroom Bungalow with Big Garden in Kibagabaga',
          description: 'Warm, family-friendly rental bungalow located in quiet Kibagabaga close to Sunset Supermarket and King Faisal Hospital. Full perimeter wall with 24/7 security guard post.',
          type: 'House',
          status: 'rent',
          price: 1800000,
          currency: 'RWF',
          province: 'Kigali City',
          district: 'Gasabo',
          sector: 'Kimironko',
          cell: 'Kibagabaga',
          village: 'Buranga',
          address: 'KG 19 Ave, Near Sunset',
          bedrooms: 4,
          bathrooms: 3,
          parking: 3,
          size: 280,
          land_size: 600,
          year_built: 2022,
          furnished: 'Furnished',
          amenities: ['Furnished', 'Water Tank', 'Large Garden', 'Wi-Fi Ready', 'Carport', 'Quiet Neighborhood'],
          phone: '+250 780 837 936',
          whatsapp: '+250780837936',
          email: 'admin@ishema.rw',
          published: true,
          cover_image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80',
          user_id: adminId,
          views: 820
        },
        {
          id: 'prop_gacuriro_land_r1',
          title: 'Prime Residential R1 Plot in Gacuriro (600 m²)',
          description: 'Exceptional flat residential plot ready for building your dream villa. All services (REG electricity, WASAC piped water) at plot boundary. Master plan zoned R1 for single-family residential.',
          type: 'Land',
          status: 'sale',
          price: 65000000,
          currency: 'RWF',
          province: 'Kigali City',
          district: 'Gasabo',
          sector: 'Kinyinya',
          cell: 'Gacuriro',
          village: 'Kagugu Border',
          address: 'Gacuriro Street 12',
          bedrooms: 0,
          bathrooms: 0,
          parking: 0,
          size: 600,
          land_size: 600,
          year_built: 2025,
          furnished: 'Unfurnished',
          amenities: ['Zoned R1', 'Tarmac Access', 'Water Connected', 'Electricity Connected', 'UPI Title Deed'],
          phone: '+250 780 837 936',
          whatsapp: '+250780837936',
          email: 'admin@ishema.rw',
          published: true,
          cover_image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80',
          user_id: adminId,
          views: 1840
        },
        {
          id: 'prop_kiyovu_penthouse',
          title: 'Luxury 3-Bedroom Penthouse in Kiyovu with Panoramic Views',
          description: 'Top floor penthouse apartment with wrap-around terrace boasting 360-degree views over downtown Kigali. Underground parking, concierge reception, and gym access.',
          type: 'Apartment',
          status: 'sale',
          price: 240000000,
          currency: 'RWF',
          province: 'Kigali City',
          district: 'Nyarugenge',
          sector: 'Nyarugenge',
          cell: 'Kiyovu',
          village: 'Inyange',
          address: 'KN 4 Ave, Old Kiyovu',
          bedrooms: 3,
          bathrooms: 3,
          parking: 2,
          size: 240,
          land_size: 0,
          year_built: 2024,
          furnished: 'Furnished',
          amenities: ['Elevator', 'Gym Access', 'Underground Parking', '24/7 Security', 'Balcony', 'Furnished'],
          phone: '+250 780 837 936',
          whatsapp: '+250780837936',
          email: 'admin@ishema.rw',
          published: true,
          cover_image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
          user_id: adminId,
          views: 1100
        },
        {
          id: 'prop_chic_office',
          title: 'Modern Office Floor in Chic Building (Kigali CBD)',
          description: 'Grade A office space in the bustling heart of Kigali Central Business District. High-speed elevators, backup power, 24/7 access control.',
          type: 'Commercial',
          status: 'rent',
          price: 4500000,
          currency: 'RWF',
          province: 'Kigali City',
          district: 'Nyarugenge',
          sector: 'Nyarugenge',
          cell: 'Kiyovu',
          village: 'Downtown',
          address: 'KN 2 Ave, Chic Building 5th Floor',
          bedrooms: 0,
          bathrooms: 4,
          parking: 6,
          size: 320,
          land_size: 0,
          year_built: 2022,
          furnished: 'Furnished',
          amenities: ['Elevators', 'Backup Generator', 'Fiber Internet', 'Central AC', 'Basement Parking'],
          phone: '+250 780 837 936',
          whatsapp: '+250780837936',
          email: 'admin@ishema.rw',
          published: true,
          cover_image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80',
          user_id: adminId,
          views: 1250
        }
      ];

      for (const p of initialProps) {
        const fullProp: Property = {
          ...p,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.data.properties.push(fullProp);

        // Seed property image
        this.data.property_images.push({
          id: 'img_' + crypto.randomUUID().slice(0, 8),
          property_id: p.id,
          url: p.cover_image,
          filename: 'cover.jpg',
          is_cover: true,
          order: 0,
          created_at: new Date().toISOString()
        });
      }
      modified = true;
    }

    if (modified) {
      this.save();
    }
  }

  // --- Users & Auth ---
  public findUserByEmail(email: string): User | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): User {
    const user: User = {
      ...userData,
      id: 'usr_' + crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.users.push(user);
    this.save();
    return user;
  }

  public updateUser(id: string, updates: Partial<Omit<User, 'id' | 'created_at'>>): User | null {
    const user = this.findUserById(id);
    if (!user) return null;
    Object.assign(user, updates, { updated_at: new Date().toISOString() });
    this.save();
    return user;
  }

  // --- Sessions ---
  public createSession(userId: string): string {
    const token = 'ishema_sess_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
    this.data.sessions.push({
      token,
      user_id: userId,
      created_at: new Date().toISOString(),
      expires_at: expiresAt
    });
    this.save();
    return token;
  }

  public getUserBySessionToken(token: string): User | null {
    const session = this.data.sessions.find(s => s.token === token);
    if (!session) return null;
    if (new Date(session.expires_at) < new Date()) {
      this.deleteSession(token);
      return null;
    }
    return this.findUserById(session.user_id) || null;
  }

  public deleteSession(token: string) {
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    this.save();
  }

  // --- Properties ---
  public getProperties(filterPublished: boolean = true): (Property & { images: PropertyImage[]; video?: PropertyVideo; user?: Partial<User> })[] {
    const props = filterPublished ? this.data.properties.filter(p => p.published) : this.data.properties;
    return props.map(p => {
      const images = this.data.property_images
        .filter(img => img.property_id === p.id)
        .sort((a, b) => a.order - b.order);
      const video = this.data.property_videos.find(v => v.property_id === p.id);
      const user = this.findUserById(p.user_id);
      return {
        ...p,
        images: images.length ? images : [{
          id: 'default',
          property_id: p.id,
          url: p.cover_image,
          filename: 'cover.jpg',
          is_cover: true,
          order: 0,
          created_at: p.created_at
        }],
        video,
        user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, photo_url: user.photo_url, role: user.role } : undefined
      };
    });
  }

  public getPropertyById(id: string): (Property & { images: PropertyImage[]; video?: PropertyVideo; user?: Partial<User> }) | null {
    const p = this.data.properties.find(prop => prop.id === id);
    if (!p) return null;
    p.views = (p.views || 0) + 1;
    this.save();

    const images = this.data.property_images
      .filter(img => img.property_id === p.id)
      .sort((a, b) => a.order - b.order);
    const video = this.data.property_videos.find(v => v.property_id === p.id);
    const user = this.findUserById(p.user_id);

    return {
      ...p,
      images: images.length ? images : [{
        id: 'default',
        property_id: p.id,
        url: p.cover_image,
        filename: 'cover.jpg',
        is_cover: true,
        order: 0,
        created_at: p.created_at
      }],
      video,
      user: user ? { id: user.id, name: user.name, email: user.email, phone: user.phone, photo_url: user.photo_url, role: user.role } : undefined
    };
  }

  public createProperty(
    propData: Omit<Property, 'id' | 'views' | 'created_at' | 'updated_at'>,
    imageUrls: { url: string; filename: string; is_cover?: boolean }[],
    videoUrl?: { url: string; filename: string }
  ): Property {
    const id = 'prop_' + Date.now() + '_' + crypto.randomUUID().slice(0, 6);
    const cover = imageUrls.find(i => i.is_cover)?.url || imageUrls[0]?.url || propData.cover_image || '';

    const newProperty: Property = {
      ...propData,
      id,
      cover_image: cover,
      views: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.data.properties.unshift(newProperty);

    // Add Images
    imageUrls.forEach((img, idx) => {
      this.data.property_images.push({
        id: 'img_' + crypto.randomUUID(),
        property_id: id,
        url: img.url,
        filename: img.filename,
        is_cover: img.is_cover || idx === 0,
        order: idx,
        created_at: new Date().toISOString()
      });
    });

    // Add Video
    if (videoUrl) {
      this.data.property_videos.push({
        id: 'vid_' + crypto.randomUUID(),
        property_id: id,
        url: videoUrl.url,
        filename: videoUrl.filename,
        created_at: new Date().toISOString()
      });
    }

    this.save();
    return newProperty;
  }

  public updateProperty(
    id: string,
    updates: Partial<Property>,
    newImages?: { url: string; filename: string; is_cover?: boolean }[],
    newVideo?: { url: string; filename: string } | null
  ): Property | null {
    const prop = this.data.properties.find(p => p.id === id);
    if (!prop) return null;

    Object.assign(prop, updates, { updated_at: new Date().toISOString() });

    if (newImages && newImages.length > 0) {
      // Replace existing images
      this.data.property_images = this.data.property_images.filter(img => img.property_id !== id);
      newImages.forEach((img, idx) => {
        this.data.property_images.push({
          id: 'img_' + crypto.randomUUID(),
          property_id: id,
          url: img.url,
          filename: img.filename,
          is_cover: img.is_cover || idx === 0,
          order: idx,
          created_at: new Date().toISOString()
        });
      });
      const cover = newImages.find(i => i.is_cover)?.url || newImages[0]?.url;
      if (cover) prop.cover_image = cover;
    }

    if (newVideo !== undefined) {
      this.data.property_videos = this.data.property_videos.filter(v => v.property_id !== id);
      if (newVideo) {
        this.data.property_videos.push({
          id: 'vid_' + crypto.randomUUID(),
          property_id: id,
          url: newVideo.url,
          filename: newVideo.filename,
          created_at: new Date().toISOString()
        });
      }
    }

    this.save();
    return prop;
  }

  public deleteProperty(id: string): boolean {
    const index = this.data.properties.findIndex(p => p.id === id);
    if (index === -1) return false;

    this.data.properties.splice(index, 1);
    this.data.property_images = this.data.property_images.filter(img => img.property_id !== id);
    this.data.property_videos = this.data.property_videos.filter(v => v.property_id !== id);
    this.data.favorites = this.data.favorites.filter(f => f.property_id !== id);
    this.save();
    return true;
  }

  public togglePublish(id: string): Property | null {
    const prop = this.data.properties.find(p => p.id === id);
    if (!prop) return null;
    prop.published = !prop.published;
    prop.updated_at = new Date().toISOString();
    this.save();
    return prop;
  }

  // --- Favorites ---
  public getUserFavorites(userId: string): Property[] {
    const favPropIds = this.data.favorites.filter(f => f.user_id === userId).map(f => f.property_id);
    return this.data.properties.filter(p => favPropIds.includes(p.id));
  }

  public toggleFavorite(userId: string, propertyId: string): boolean {
    const index = this.data.favorites.findIndex(f => f.user_id === userId && f.property_id === propertyId);
    let added = false;
    if (index === -1) {
      this.data.favorites.push({
        id: 'fav_' + crypto.randomUUID(),
        user_id: userId,
        property_id: propertyId,
        created_at: new Date().toISOString()
      });
      added = true;
    } else {
      this.data.favorites.splice(index, 1);
      added = false;
    }
    this.save();
    return added;
  }

  // --- Inquiries ---
  public createInquiry(data: Omit<Inquiry, 'id' | 'status' | 'created_at'>): Inquiry {
    const inq: Inquiry = {
      ...data,
      id: 'inq_' + crypto.randomUUID(),
      status: 'pending',
      created_at: new Date().toISOString()
    };
    this.data.inquiries.unshift(inq);
    this.save();
    return inq;
  }

  public getInquiries(): Inquiry[] {
    return this.data.inquiries;
  }

  public getStats() {
    return {
      total_properties: this.data.properties.length,
      published_properties: this.data.properties.filter(p => p.published).length,
      sale_properties: this.data.properties.filter(p => p.status === 'sale').length,
      rent_properties: this.data.properties.filter(p => p.status === 'rent').length,
      land_properties: this.data.properties.filter(p => p.type === 'Land').length,
      total_users: this.data.users.length,
      total_inquiries: this.data.inquiries.length
    };
  }
}

export const db = new Database();
