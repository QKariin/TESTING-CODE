const express = require('express');
const compression = require('compression');
const app = express();

// This is "Step 6" - it squeezes your code to make it tiny and fast!
app.use(compression());

// This tells the Boss to look at all the files in your folder
app.use(express.static(__dirname));

// This tells the Boss to start working!
app.listen(3000, '0.0.0.0', () => {
  console.log("The LEGO Boss is awake with a megaphone!");
});