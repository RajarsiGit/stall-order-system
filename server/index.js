require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Food order API running on http://localhost:${PORT}`));
