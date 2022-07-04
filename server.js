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

const ejs = require("ejs");


//this handles the state/nonce
const crypto = require('crypto');
const nonce = crypto.randomBytes(16).toString('base64');

//Make the app use express
const app = express();
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: true,
    resave: false,
    maxAge: 1000 * 60 * 15,
    cookie:{
        secure: true
        }
  }));

app.use(express.urlencoded({ extended: true }));

app.use(passport.initialize());
app.use(passport.session());

//Set port to default port based on project server or 4000
const port = process.env.PORT || 3000;

//Check whether user has logged in
const isLoggedin = (req, res, next)=>{
    req.user ?  next(): res.redirect('/');
}


passport.use(new OAuth2Strategy({
    authorizationURL: process.env.SANDBOX_OAUTH,
    tokenURL: process.env.SANDBOX_TOKEN_URL,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.OAUTH_REDIRECT_URI 
  },
  function(accessToken, refreshToken, params, profile, cb) {
    return cb(null, params); //Params from Starling Bank Website
  }
));

const endpointLink = process.env.SANDBOX_API;

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

app.use(express.static("public"));

//Use urlencoded to get post request from forms
app.use(express.urlencoded({ extended: true }));


app.route('/')
.get((req, res)=>{

    res.render('login');

})


app.route('/auth')
.get(passport.authenticate('oauth2', 
    {
        scope:[
            'account:read', 'account-list:read', 
            'account-identifier:read', 'account-holder-name:read', 
            'account-holder-type:read', 'balance:read', 
            'savings-goal:read', 'savings-goal:create', 
            'savings-goal:delete', 'savings-goal-transfer:read', 
            'savings-goal-transfer:create', 'savings-goal-transfer:delete', 
            'space:read', 'transaction:read'
        ], 
        state:nonce
    }
))



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


app.route('/auth/logout')
.get(isLoggedin,(req, res) => {

    req.session = null
    res.redirect('/');
});

//Function to Set
const setHeaders = (tokenType, accessToken)=>{

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
const formatCurrency = (amount, currency='GBP')=>{
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency }).format(amount/100);
}



app.route('/dashboard')
.get(isLoggedin,(req, res) => {

    let years = 2022;
    let months = 10;

    const userInfo = req.user;
    
    const headers = setHeaders(userInfo.token_type, userInfo.access_token);

    const endpoints = [
        `${endpointLink}/api/v2/account-holder`,
        `${endpointLink}/api/v2/identity/individual`,
        `${endpointLink}/api/v2/accounts`,
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
        const accountCreated = accounts[0].createdAt; //when the account was created
        const now = new Date();

        let firstOfTheMonth = new Date(
            !years ? now.getFullYear(): years, 
            !months ? now.getMonth(): months, 1).toISOString();

        // if (years === null || months === null) {

        //     const firstOfTheMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // } else {

        //     const firstOfTheMonth = new Date(years, months, 1).toISOString();
        // }

        console.log(years, months)
       

        axios.get(`${endpointLink}/api/v2/accounts/${accountUid}/balance`, headers)
        .then((result)=>{
        
            const balance = result.data;

            const tCBalance = balance.totalClearedBalance;
            const displayBalance = formatCurrency(tCBalance.minorUnits)


            axios.get(`${endpointLink}/api/v2/feed/account/${accountUid}/category/${categoryUid}?changesSince=${firstOfTheMonth}`, headers)
            .then((aResult) => {
                
                const feed = aResult.data.feedItems; //this is an array
                // console.log(feed);


                // Groups Transaction Feed items by spending category, direction and status
                const groupFeed = (feed, direction, status = 'SETTLED') => {

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
                const percentCalc = (monthlySaving/totalIn) * 100
                const savingInPercent = `${percentCalc.toFixed(2)}%` 

                //Daily Calculations
                const getDaysInMonth = (year, month) => {
                    return new Date(year, month, 0).getDate();
                }

                const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth())

                const remainder = monthlySaving % daysInMonth;
                let dailySaving = (monthlySaving - remainder)/daysInMonth;
                
                //Calendar - Daily Plan
                const textDays = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
                const dailyPlan = [];

                let firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                let firstDateOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDate();

                for(let i = 0; i < daysInMonth; i++){

                    if(firstDateOfMonth === daysInMonth){
                      dailySaving = dailySaving + remainder;
                    }
                    const cashOutput = formatCurrency(dailySaving);
                    dailyPlan.push({date:firstDateOfMonth, day:textDays[firstDayOfMonth % textDays.length], save:cashOutput});
                    firstDayOfMonth++
                    firstDateOfMonth++
                }


                // axios.get(`${endpointLink}/api/v2/account/${accountUid}/savings-goals`, headers)
                // .then((spaces)=>{

                //     console.log('SPACES\n' + spaces)

                // })
                // .catch((err)=>{
                //     console.error(err)
                // })

                res.render('dashboard', {
                    identity: identity, accountHolder: accountHolder, displayBalance:displayBalance,
                    groupedInFeed:groupedInFeed, groupedOutFeed:groupedOutFeed, 
                    totalIn:totalIn, totalOut:totalOut, monthlySaving:monthlySaving,
                    dailyPlan:dailyPlan, savingInPercent:savingInPercent, formatCurrency:formatCurrency,
                    accountCreated:accountCreated, today:now
                });

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
    
})
.post(isLoggedin, (req, res)=>{

    const years = req.body.years
    const months = req.body.months

    console.log(years, months);
});

app.route('/dashboard/add-to-space')
.post(isLoggedin, (req, res)=>{

    const spaceName = req.body.name;
    const accountUid = req.body.accountUid;
    const currency = req.body.currency;
    const amount = req.body.amount;

    console.log(`${spaceName}\n${accountUid}\n${currency}\n${amount}`)

    const userInfo = req.user;
    
    const headers = setHeaders(userInfo.token_type, userInfo.access_token);

    axios.put(`${endpointLink}/api/v2/account/${accountUid}/savings-goals`, headers, 
        {
        "name": spaceName,
        "currency": currency,
        "target": {
          "currency": currency,
          "minorUnits": amount
        },
        "base64EncodedPhoto": "string"
    })
    .then(()=>{
        console.log("success")
    })
    .catch((err)=>{
        console.error(err)
    })
})

///////////////////////////PORT LISTEN//////////////////////////////////////////
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});