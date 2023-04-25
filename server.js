const express = require('express')
const path = require('path')
const app = express()
const port = process.env.PORT || 8080
const web3 = require('web3')

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
    // Then, logic for creating passport or importing it and maintaining in session (?)
    // Username must be unique (?) in case of registration
    
    if (req.body.todo == "Registrati") {

        res.sendFile(path.join(__dirname, 'web/home.html'));
    } else if (req.body.todo == "Login") {

        res.sendFile(path.join(__dirname, 'web/home.html'));
    } else res.send(400)
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
1) Only this (maybe others? --> clients should become servers) Node.js server can claim ownership (clients cannot?) --> limitation of the framework?
1a) One-Point-Failure --> my Node.js server, if taken down, would interrupt access to the chat and data stored as I'm the owner(IS THIS AN ARCHITECTURAL PROBLEM OF C/S APPS????)
2) No verification of multiple identities by same user
3) 

*/