//jshint esversion:6
//Make sure you start this at the beginning of every project and use .gitignore too
require("dotenv").config(); // This is to protect our codes, api keys etc.

const express = require("express");
const path = require("path");

//Make the app use express
const app = express();

//Set port to default port based on project server or 4000
const port = process.env.PORT || 3000;

const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');


passport.use(new OAuth2Strategy({
    authorizationURL: process.env.OAUTH_API,
    tokenURL: process.env.PERSONL_ACCESS_TOKEN,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.OAUTH_REDIRECT_URI
  },
  function(accessToken, refreshToken, profile, cb) {
    return cb(err, profile);
  }
));

passport.serializeUser((user, done)=>{
    done(null, user);
});

passport.deserializeUser((user, done)=>{
    done(null, user);
});

//process.env.NODE_ENV => production or undefined
if(process.env.NODE_ENV === "production"){
  app.use(express.static(path.join(__dirname,"/client/build")))
}

app.route('/')
.get((req, res)=>{
    res.send(`
        <h1>Welcome to my App</h1> 
        <a href="/auth">Authenticate</a>
    `)
})

app.route('/auth')
.get(passport.authenticate('oauth2', {scope: ['account']}))

app.get('/auth/callback',
  passport.authenticate('oauth2', { failureRedirect: '/' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/dashboard');
  });

app.route('/dashboard')
.get((req, res)=>{
    res.send('Hello')
})

///////////////////////////PORT LISTEN//////////////////////////////////////////
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
