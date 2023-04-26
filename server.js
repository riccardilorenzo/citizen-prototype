require('dotenv').config()
const express = require('express')
const path = require('path')
const app = express()
const port = process.env.PORT || 8080
const Web3 = require('web3')
const web3 = new Web3("https://eth-sepolia.g.alchemy.com/v2/8x2F5HFoIq2l6JtbfKI072IC4xTJDEAe")
const privateKey = Buffer.from(process.env.PRIVATE_KEY)

app.use(express.static(__dirname + '/web'))

/*function requireRole (role) {
    return function (req, res, next) {
        if (req.session.user && req.session.user.role === role) {
            next();
        } else {
            res.send(403);
        }
    }
}

app.get("/foo", foo.index);
app.get("/foo/:id", requireRole("user"), foo.show);
app.post("/foo", requireRole("admin"), foo.create);

// All bars are protected
app.all("/foo/bar", requireRole("admin"));

// All paths starting with "/foo/bar/" are protected
app.all("/foo/bar/*", requireRole("user"));
*/

function isAuthenticated(request) {
    if (request.session && request.session.logged && request.session.logged == true)
        return true
    return false
}

app.get("/", function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
})

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, 'web/login.html'));
})

app.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, 'web/register.html'));
})

app.post("/home", (req, res) => {
    // Logic for creating passport or importing it and maintaining in session (?)
    // Username must be unique (?) in case of registration

    // NOT NECESSARY BECAUSE THIS IS A POST REQUEST (SEE GET REQUEST UNDER THIS)
    /*if (req.session.logged && req.session.logged == true) {
        res.sendFile(path.join(__dirname, 'web/home.html'))
        return
    }*/
    
    if (req.body.todo == "Registrati") {

        res.sendFile(path.join(__dirname, 'web/home.html'));
    } else if (req.body.todo == "Login") {

        res.sendFile(path.join(__dirname, 'web/home.html'));
    } else res.send(400)
})

app.get("/home", (req, res) => {
    if (isAuthenticated(req)) {
        res.sendFile(path.join(__dirname, 'web/home.html'))
    } else res.sendFile(path.join(__dirname, 'web/notAuth.html'))
})

app.post("/publishMessage", (req, res) => {
    // AJAX for putting messages. Check permissions (?) and then simply respond with 200.
    // Of course you need to save the message in the blockchain.
})

app.listen(port, () => {
    // I can put here the logic for checking if an account for holding messages is present (SHOULD I GO THIS WAY????)
    // if not, I should create it here
    // if yes, retrieving all messages

})


/* IMPORTANT POINTS:
1) Only this (maybe others? --> clients should become servers) Node.js server can claim ownership (clients cannot?) --> FRAMEWORK MADE THIS WAY
1a) One-Point-Failure --> my Node.js server, if taken down, would interrupt access to the chat and data stored as I'm the owner (IS THIS AN ARCHITECTURAL PROBLEM OF C/S APPS????)
2) No verification of multiple identities by same user
3) 

*/