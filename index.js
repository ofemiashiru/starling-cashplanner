//jshint esversion:6
//Make sure you start this at the beginning of every project and use .gitignore too
require('dotenv').config(); // This is to protect our codes, api keys etc.

const express = require('express');
const session = require('express-session')
const path = require('path');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const axios = require('axios');

//this handles the state
const crypto = require('crypto');
let nonce = crypto.randomBytes(16).toString('base64');

//Make the app use express
const app = express();

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
    // cookie: {maxAge: 1200000} //regulates how long the session lasts for in Milliseconds
  }));

app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session())

//Set port to default port based on project server or 4000
const port = process.env.PORT || 3000;


function isLoggedin(req, res, next){
    req.user ?  next(): res.redirect('/')
}


passport.use(new OAuth2Strategy({
    authorizationURL: process.env.SANDBOX_API,
    tokenURL: process.env.TOKEN_URL,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.OAUTH_REDIRECT_URI 
  },
  function(accessToken, refreshToken, params, profile, cb) {
    return cb(null, params); //Params from Starling Website
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
.get(passport.authenticate('oauth2', {scope:[], state:nonce}))


app.route('/auth/callback')
.get(passport.authenticate('oauth2', { failureRedirect: '/auth/failure' }),

function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/dashboard');
});



app.route('/auth/failure')
.get((req, res) => {
    res.send('<h1>Something went wrong</h1>')
});


app.route('/auth/logout')
.get((req, res, next) => {
    // req.logout((err)=>{
    //     if(err){
    //         return next(err)
    //     }
    // });
    
    req.session.destroy();
    res.redirect('/');
});


app.route('/dashboard')
.get(isLoggedin,(req, res) => {
    const userInfo = req.user

    //Get AccountHolderUiD
    axios.get('https://api-sandbox.starlingbank.com/api/v2/account-holder', 
    {
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `${userInfo.token_type} ${userInfo.access_token}`
        }
    })
    .then((response) => 
    {
        const accountHolderUid = response.data.accountHolderUid;
    })
    .catch((error) => 
    {
        console.error(error)
    })

    //Get Account Holder Name and Details
    axios.get('https://api-sandbox.starlingbank.com/api/v2/identity/individual', 
    {
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `${userInfo.token_type} ${userInfo.access_token}`
        }
    })
    .then((response) => 
    {
       const title = response.data.title 
       const firstName = response.data.firstName 
       const lastName = response.data.lastName
       const email = response.data.email

       res.send(
            `
            <h1>Hello ${title} ${firstName} ${lastName}</h1>
            <h2>${email}</h2>
            <a href="/auth/logout">Log Out</a>
            `
        );
       
    })
    .catch((error) => 
    {
        console.error(error)
    })

  
});




///////////////////////////PORT LISTEN//////////////////////////////////////////
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
