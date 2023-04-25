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
    // Differentiate between LOGIN and REGISTER
    // Then, logic for creating passport or importing it and maintaining in session (?)
    // Username must be unique (?) in case of registration

    res.sendFile(path.join(__dirname, 'web/home.html'));
})

app.post("/publishMessage", (req, res) => {
    // AJAX for putting messages. Check permissions (?) and then simply respond with 200.
    // Of course you need to save the message in the blockchain.
})

app.listen(port, () => {})