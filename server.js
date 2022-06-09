//jshint esversion:6
//Make sure you start this at the beginning of every project and use .gitignore too
require('dotenv').config(); // This is to protect our codes, api keys etc.

const express = require('express');
// const session = require('express-session');
const session = require('cookie-session');
const path = require('path');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const axios = require('axios');

//this handles the state
const crypto = require('crypto');
let nonce = crypto.randomBytes(16).toString('base64');

//Make the app use express
const app = express();
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: false,
    maxAge: 1000 * 60 * 15,
    cookie:{
        secure: true
        }
    // cookie: {maxAge: 1200000} //regulates how long the session lasts for in Milliseconds
  }));

app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());

//Set port to default port based on project server or 4000
const port = process.env.PORT || 3000;


function isLoggedin(req, res, next){
    req.user ?  next(): res.redirect('/');
}


passport.use(new OAuth2Strategy({
    authorizationURL: process.env.SANDBOX_API,
    tokenURL: process.env.TOKEN_URL,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.OAUTH_REDIRECT_URI 
  },
  function(accessToken, refreshToken, params, profile, cb) {
    return cb(null, params); //Params from Starling Bank Website
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
  app.use(express.static(path.join(__dirname,"/client/build")));
}

app.route('/')
.get((req, res)=>{
    res.send(`
        <h1>Welcome to my App</h1> 
        <a href="/auth">Authenticate with Starling Bank</a>
    `);
})


app.route('/auth')
.get(passport.authenticate('oauth2', {scope:[], state:nonce}));


app.route('/auth/callback')
.get(passport.authenticate('oauth2', { failureRedirect: '/auth/failure' }),

    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect('/dashboard');
    }
);


app.route('/auth/failure')
.get((req, res) => {
    res.send('<h1>Something went wrong</h1>');
});

//Function to Set
function setHeaders(tokenType, accessToken){

    const theHeaders =  {
        headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `${tokenType} ${accessToken}`
        }
    }
    
    return theHeaders;

}

//Currency Changer
function formatCurrency(amount, currency='GBP'){
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency }).format(amount/100);
}

app.route('/auth/logout')
.get((req, res, next) => {

    const userInfo = req.user;

    const headers = setHeaders(userInfo.token_type, userInfo.access_token);

    req.logOut();

    // req.logOut((err)=>{
    //     if(err){
    //         return next(err);
    //     } else {

    //         axios.put('https://api-sandbox.starlingbank.com/api/v2/identity/logout', headers)

    //         req.session.destroy();
    //         res.redirect('/');
    //     }
    // });
    
});


app.route('/dashboard')
.get(isLoggedin,(req, res) => {

    const userInfo = req.user;
    
    const headers = setHeaders(userInfo.token_type, userInfo.access_token);

    const endpoints = [
        'https://api-sandbox.starlingbank.com/api/v2/account-holder',
        'https://api-sandbox.starlingbank.com/api/v2/identity/individual',
        'https://api-sandbox.starlingbank.com/api/v2/accounts',
    ];

    const allRequests = endpoints.map((link)=>{
        return axios.get(link, headers);
    })


    axios.all(allRequests)
    .then((response)=>{
        
        const accountHolder = response[0].data;
        const identity = response[1].data;
        const accounts = response[2].data.accounts;

        console.log(accountHolder, identity, accounts);

        const accountUid = accounts[0].accountUid;
        const categoryUid = accounts[0].defaultCategory;

        //Dates
        const accountCreated = accounts[0].createdAt;
        const now = new Date();
        const firstOfTheMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        console.log(firstOfTheMonth)
       
        axios.get(`https://api-sandbox.starlingbank.com/api/v2/accounts/${accountUid}/balance`, headers)
        .then((result)=>{
        
            const balance = result.data;
            console.log(balance);

            const tCBalance = balance.totalClearedBalance;
            const displayBalance = formatCurrency(tCBalance.minorUnits)


            axios.get(`https://api-sandbox.starlingbank.com/api/v2/feed/account/${accountUid}/category/${categoryUid}?changesSince=${firstOfTheMonth}`, headers)
            .then((aResult)=>{
                
                const feed = aResult.data.feedItems; //this is an array
                // console.log(feed);


                // Groups Transaction Feed items by spending category, direction and status
                function groupFeed(feed, direction, status = 'SETTLED'){

                    const holder = {};
                    const groupedFeed = [];

                    feed.forEach((item) => {

                        if (item.direction === direction && item.status === status){ 

                            if (holder.hasOwnProperty(item.spendingCategory)){
                                holder[item.spendingCategory] = holder[item.spendingCategory] + item.amount.minorUnits;
                            } else {
                                holder[item.spendingCategory] = item.amount.minorUnits;
                            }

                        }

                    })

                    for (let prop in holder){
                        groupedFeed.push({spendingCategory:prop, amount:holder[prop]})
                    }

                    return groupedFeed;

                }

                const groupedInFeed = groupFeed(feed, 'IN');
                const totalIn =  groupedInFeed.reduce(function (acc, obj) { return acc + obj.amount; }, 0);
    
                const groupedOutFeed = groupFeed(feed, 'OUT');
                const totalOut =  groupedOutFeed.reduce(function (acc, obj) { return acc + obj.amount; }, 0);

                const monthlySaving = totalIn - totalOut;



                res.send(
                    `
                        <h1>Hello ${identity.title} ${identity.firstName} ${identity.lastName}</h1>
                        <h2>${identity.email}</h2>
                        <p>
                            Account type: ${accountHolder.accountHolderType}
                        </p>
                        <h2>
                            You have ${displayBalance} to spend
                        </h2>
        
                        <h2>Money In</h2>
                        ${groupedInFeed.map((item) => `<p>${item.spendingCategory} ${formatCurrency(item.amount)}</p>`)}

                        <h2>Money Out</h2>
                        ${groupedOutFeed.map((item) => `<p>${item.spendingCategory} ${formatCurrency(item.amount)}</p>`)}

                        <h2>Totals</h2>
                        <p>MONTHLY IN ${formatCurrency(totalIn)}</p>
                        <p>MONTHLY OUT ${formatCurrency(totalOut)}</p>

                        <h2>This Months Saving</h2>

                        <p>MONTHLY SAVING ${formatCurrency(monthlySaving)}</p> 

                        <a href="/auth/logout">Log Out</a>
                    `
                );

            })
            .catch((err)=>{
                console.error(err);
            })
          
        })
        .catch((err)=>{
            console.error(err);
        })

    })
    .catch(err =>{
        console.error(err);
    })
    
});

///////////////////////////PORT LISTEN//////////////////////////////////////////
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});