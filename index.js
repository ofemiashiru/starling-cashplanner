//jshint esversion:6
//Make sure you start this at the beginning of every project and use .gitignore too
require("dotenv").config(); // This is to protect our codes, api keys etc.

const express = require("express");
const path = require("path");

//Make the app use express
const app = express();

//Set port to default port based on project server or 4000
const port = process.env.PORT || 3000;


//process.env.NODE_ENV => production or undefined
if(process.env.NODE_ENV === "production"){
  app.use(express.static(path.join(__dirname,"/client/build")))
}

app.route('/')
.get((req, res)=>{
    res.send('<h1>Hello</h1>')
})


///////////////////////////PORT LISTEN//////////////////////////////////////////
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
