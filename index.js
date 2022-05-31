//jshint esversion:6
//Make sure you start this at the beginning of every project and use .gitignore too
require('dotenv').config(); // This is to protect our codes, api keys etc.

const express = require('express');
const session = require('express-session')
const path = require('path');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
//Make the app use express
const app = express();

app.use(session({secret:'cats'}));
app.use(passport.initialize());
app.use(passport.session())
//Set port to default port based on project server or 4000
const port = process.env.PORT || 3000;




function isLoggedin(req, res, next){
    req.user ?  next(): res.sendStatus(401)
}


passport.use(new OAuth2Strategy({
    authorizationURL: process.env.OAUTH_API,
    tokenURL: process.env.PRODUCTION_API,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.OAUTH_REDIRECT_URI
  },
  function(accessToken, refreshToken, profile, cb) {
    return cb(null, profile);
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
.get(passport.authenticate('oauth2', {scope:['account:read']}))


app.route('/auth/callback')
.get(passport.authenticate('oauth2', 
{
    successRedirect: '/dashboard', 
    failureRedirect: '/auth/failure' 
}))

app.route('auth/failure')
.get((req, res)=>{
    res.send('<h1>Something went wrong</h1>')
})

app.route('/dashboard')
.get(isLoggedin,(req, res)=>{
    res.send('Hello')
})

///////////////////////////PORT LISTEN//////////////////////////////////////////
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
