function validateLocation(input) {
  const invalid = () => { const error = new Error('Choose a location with a name and valid latitude and longitude.'); error.status = 400; throw error; };
  if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 160) invalid();
  if (typeof input.latitude !== 'number' || !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 || typeof input.longitude !== 'number' || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) invalid();
  return { name: input.name.trim(), latitude: Number(input.latitude.toFixed(4)), longitude: Number(input.longitude.toFixed(4)) };
}
module.exports = { validateLocation };
