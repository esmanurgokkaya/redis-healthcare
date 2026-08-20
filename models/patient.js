const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
  name: String,
  age: Number,
  diagnosis: String,
  doctor: {
    name: String,
    specialty: String
  }
});

module.exports = mongoose.model('Patient', patientSchema);