import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Gunakan PORT dari Railway (otomatis), default 3000 kalau lokal
const PORT = process.env.PORT || 3000;

// Koneksi ke Database MySQL
const db = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// ====[ 1️⃣ Route Webhook Tally ]====
app.post("/tally-webhook", async (req, res) => {
  try {
    const data = req.body.data || req.body; // data dari Tally
    console.log("Data diterima dari Tally:", data);

    // Ambil data form
    const nama = data.nama || data["Nama"] || "Tidak diketahui";
    const sekolah = data.sekolah || data["Sekolah"] || "-";
    const kategori = data.kategori || data["Kategori"] || "-";
    const bukti_transfer = data.bukti_transfer || data["Bukti Transfer"] || "-";

    // Buat token unik untuk QR
    const token = uuidv4();

    // Simpan ke database
    await db.execute(
      "INSERT INTO peserta (nama, sekolah, kategori, bukti_transfer, token) VALUES (?, ?, ?, ?, ?)",
      [nama, sekolah, kategori, bukti_transfer, token]
    );

    // Buat link verifikasi & QR
    const verifyUrl = `${process.env.BASE_URL}/verify/${token}`;
    const qrCode = await QRCode.toDataURL(verifyUrl);

    console.log("✅ Data peserta tersimpan:", { nama, sekolah, kategori, verifyUrl });

    res.status(200).json({
      success: true,
      message: "Data berhasil disimpan dan QR dibuat.",
      verifyUrl,
      qrCode,
    });
  } catch (err) {
    console.error("❌ Error webhook:", err);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
});

// ====[ 2️⃣ Route Verifikasi QR ]====
app.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const [rows] = await db.execute("SELECT * FROM peserta WHERE token = ?", [token]);

    if (rows.length === 0) {
      return res.status(404).send("<h2>QR Tidak Valid ❌</h2>");
    }

    const peserta = rows[0];

    res.send(`
      <h1>🎟️ Bukti Pengambilan Nasi Kuning</h1>
      <p><b>Nama:</b> ${peserta.nama}</p>
      <p><b>Sekolah:</b> ${peserta.sekolah}</p>
      <p><b>Kategori:</b> ${peserta.kategori}</p>
      <p><b>Bukti Transfer:</b> ${peserta.bukti_transfer}</p>
      <hr>
      <p>✅ Data valid dan terdaftar.</p>
    `);
  } catch (err) {
    console.error("❌ Error verify:", err);
    res.status(500).send("<h2>Terjadi kesalahan server</h2>");
  }
});

// ====[ 3️⃣ Route Tes Server ]====
app.get("/", (req, res) => {
  res.send("🚀 Tally QR Server aktif di Railway!");
});

app.listen(PORT, () => {
  console.log(`✅ Server berjalan di port ${PORT}`);
});
