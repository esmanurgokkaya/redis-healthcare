const express = require('express');
const mongoose = require('mongoose');
const { redisClient, connectRedis } = require('./redisClient');
const Patient = require('./models/patient');

const app = express();

async function rateLimiter(req, res, next) {
  const ip = req.ip; 
  const key = `ratelimit:${ip}`;

  const count = await redisClient.incr(key);

  if (count === 1) {
    await redisClient.expire(key, 30); 
  }

  console.log(`IP: ${ip} - İstek sayısı: ${count}`);

  if (count > 5) {
    return res.status(429).send('Çok fazla istek attın, 30 saniye bekle.');
  }

  next();
}

app.use(express.json());

app.post('/patient', async (req, res) => {
  try {
    const patient = new Patient(req.body);
    await patient.save();
    res.status(201).json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).send('Hasta eklenemedi');
  }
});
app.get('/patient/:id', rateLimiter, async (req, res) => {
  const patientId = req.params.id;
  const cacheKey = `patient:${patientId}`;
  const viewCountKey = `views:${patientId}`;

  
  const viewCount = await redisClient.incr(viewCountKey);
  console.log(`Görüntülenme sayısı: ${viewCount}`);

  console.time('Toplam süre');

  const cached = await redisClient.get(cacheKey);

  if (cached) {
    console.log('CACHE HIT');
    console.timeEnd('Toplam süre');
    return res.json(JSON.parse(cached));
  }

  console.log('CACHE MISS');
  const patient = await Patient.findById(patientId);

  if (!patient) {
    console.timeEnd('Toplam süre');
    return res.status(404).send('Hasta bulunamadı');
  }

  await redisClient.set(cacheKey, JSON.stringify(patient), { EX: 60 });

  console.timeEnd('Toplam süre');
  res.json(patient);
});

app.put('/patient/:id', async (req, res) => {
  const patientId = req.params.id;
  const cacheKey = `patient:${patientId}`;

  try {
    const updatedPatient = await Patient.findByIdAndUpdate(
      patientId,
      req.body,
      { new: true }
    );

    if (!updatedPatient) {
      return res.status(404).send('Hasta bulunamadı');
    }

    await redisClient.del(cacheKey);
    console.log('Cache silindi:', cacheKey);

    res.json(updatedPatient);
  } catch (err) {
    console.error(err);
    res.status(500).send('Güncelleme başarısız');
  }
});


app.get('/patient/:id/views', async (req, res) => {
  const viewCountKey = `views:${req.params.id}`;
  const count = await redisClient.get(viewCountKey);
  res.json({ patientId: req.params.id, views: count || 0 });
});

async function start() {
  await mongoose.connect('mongodb://localhost:27017/healthcareDB');
  console.log('MongoDB bağlandı');

  await connectRedis();

  app.listen(3000, () => console.log('Sunucu 3000 portunda'));
}

start();