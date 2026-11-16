
require("dotenv").config();

const createApp = require("./app");
const { getJwtSecret } = require("./config/auth");

const PORT = process.env.PORT || 5000;

getJwtSecret();
const app = createApp();

app.listen(PORT, () => {
    console.log(`Taskora server running on port ${PORT}`);
});
