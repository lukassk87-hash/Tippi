import sharp from "sharp";
import fs from "fs";
import path from "path";

const dir = "www/resources";

if (!fs.existsSync(dir)) {
  console.log("⚠️  www/resources Ordner nicht gefunden – überspringe Bildoptimierung.");
  process.exit(0);
}

const files = fs.readdirSync(dir).filter(f =>
  f.endsWith(".jpg") ||
  f.endsWith(".jpeg") ||
  f.endsWith(".png") ||
  f.endsWith(".webp")
);

console.log("🔧 Optimizing images in www/resources ...");

for (const file of files) {
  const full = path.join(dir, file);

  sharp(full)
    .resize(512, 512, { fit: "inside" })
    .jpeg({ quality: 80 })
    .toBuffer()
    .then(buffer => {
      fs.writeFileSync(full, buffer);
      console.log("✔ Optimized:", file);
    })
    .catch(err => console.error("❌ Error:", file, err));
}