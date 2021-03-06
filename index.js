const express = require("express");
const multer = require("multer");
const { replaceBackground } = require("backrem");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

const port = process.env.PORT || 8080;

const db = {};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

app.post("/upload", upload.single("image"), (req, res) => {
  const id = req.file.filename;
  db[id] = { id, createdAt: Date.now(), ...req.file };
  res.send({ id });
});

app.get("/list", (req, res) => {
  res.json(
    Object.values(db).map((item) => ({
      id: item.id,
      createdAt: item.createdAt,
      size: item.size,
      name: item.originalname,
    }))
  );
});

app.get("/image/:id", (req, res) => {
  const id = req.params.id;
  if (!db[id]) {
    res.status(404).send();
  } else {
    res.setHeader("Content-Type", db[id].mimetype);
    const stream = fs.createReadStream(path.resolve(__dirname, db[id].path));
    stream.pipe(res);
  }
});

app.delete("/image/:id", (req, res) => {
  const id = req.params.id;
  if (!db[id]) {
    res.status(404).send();
  } else {
    fs.unlink(path.resolve(__dirname, db[id].path), (err) => {
      if (err) {
        res.status(500).send(err.message);
      }
      delete db[id];
      res.status(200).send();
    });
  }
});

app.get("/merge", (req, res) => {
  try {
    const { front, back, color = "255,255,255", threshold = 0 } = req.query;
    let colorTokens = color.split(",").map((item) => +item);
    if (
      colorTokens.length != 3 ||
      colorTokens.some((item) => item < 0 || item > 255)
    ) {
      const rgb = hexToRgb(color);
      if (rgb) {
        colorTokens = [rgb.r, rgb.g, rgb.b];
      } else {
        res.status(400).send("color is invalid");
      }
    }
    if (!front || !back || !db[front] || !db[back]) {
      res.status(404).send("image invalid or not found");
      return;
    }

    const backImage = fs.createReadStream(
      path.resolve(__dirname, db[back].path)
    );
    const frontImage = fs.createReadStream(
      path.resolve(__dirname, db[front].path)
    );
    res.setHeader("Content-Type", "image/jpeg");
    replaceBackground(frontImage, backImage, colorTokens, threshold).then(
      (stream) => stream.pipe(res)
    );
  } catch (e) {
    console.log(e);
    res.status(400).send(e.message);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on ${port} port`);
});
