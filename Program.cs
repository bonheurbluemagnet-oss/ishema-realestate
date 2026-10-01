var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Enable serving default files (e.g. index.html) and static files from wwwroot
app.UseDefaultFiles();
app.UseStaticFiles();

// Sample health-check endpoint
app.MapGet("/api/health", () => Results.Ok(new
{
    status = "healthy",
    application = "ISHEMA Real Estate",
    tagline = "Find Your Home. Find Your Land. Build Your Future.",
    timestamp = DateTime.UtcNow
}));

app.Run();
