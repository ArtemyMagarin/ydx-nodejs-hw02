const express = require("express");
const multer = require("multer");
const { replaceBackground } = require("backrem");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });

const port = process.env.PORT || 8080;

const db = {};

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

app.get("/merge", (req, res, next) => {
  try {
    const { front, back, color = "255,255,255", treshold = 0 } = req.query;
    const colorTokens = color.split(",").map((item) => +item);
    if (
      colorTokens.length != 3 ||
      colorTokens.some((item) => item < 0 || item > 255)
    ) {
      res.status(400).send("color is invalid");
      next();
    }
    if (!front || !back || !db[front] || !db[back]) {
      res.status(404).send("image invalid or not found");
      next();
    }

    const backImage = fs.createReadStream(
      path.resolve(__dirname, db[back].path)
    );
    const frontImage = fs.createReadStream(
      path.resolve(__dirname, db[front].path)
    );
    res.setHeader("Content-Type", db[front].mimetype);
    replaceBackground(frontImage, backImage, colorTokens, treshold).then(
      (stream) => stream.pipe(res)
    );
  } catch (e) {
    res.status(400).send();
  }
});

app.listen(port, () => {
  console.log(`Example app listening on ${port} port`);
});
