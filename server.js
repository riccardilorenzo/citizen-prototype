require('dotenv').config()

const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const { createHash } = require('crypto');
const path = require('path')
const app = express()
const port = process.env.PORT || 8080

const Web3 = require('web3')
const web3 = new Web3("https://eth-sepolia.g.alchemy.com/v2/" + process.env.API_URL)
const privateKey = process.env.PRIVATE_KEY
const bufferedPrivateKey = Buffer.from(privateKey)

//import { PassportReader } from 'verifiable-data'
const vd = require('verifiable-data')
const passportLogicAddress = process.env.PASSPORTLOGIC_ADDRESS
const passportLogicRegistryAddress = process.env.PASSPORTLOGICREGISTRY_ADDRESS
const passportFactoryAddress = process.env.PASSPORTFACTORY_ADDRESS
const tesiEthereumAddress = process.env.TESI_ETHEREUM_ADDRESS
const passportReader = new vd.PassportReader(web3)
const historyFactReader = new vd.FactHistoryReader(web3)
const generator = new vd.PassportGenerator(web3, passportFactoryAddress)
let chatHolderAddress = process.env.CHAT_HOLDER_ADDRESS
const chatWriter = new vd.FactWriter(web3, chatHolderAddress)

app.use(express.static(__dirname + '/web'))
app.use(
    session({
      secret: process.env.ENCRYPTION_KEY,
      resave: true,
      saveUninitialized: false,
    })
)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.text())

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

async function sendTransaction(txConfig) {
    var signedTx = await web3.eth.accounts.signTransaction(txConfig, privateKey)
    /*await web3.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, receipt) {
        if (!error) {
            return receipt
        } else {
            console.log("Error during the submission of the signed transaction, try again!")
            console.log(error)
            //exit()
            return null
        }
    })*/
    return web3.eth.sendSignedTransaction(signedTx.rawTransaction)
}

async function retrieveAllMessages() {
    var messages = []
    let names = {}
    let currentRecord

    let pps = await passportReader.getPassportsList(passportFactoryAddress)
    for (let i in pps) {
        let history = await passportReader.readPassportHistory(pps[i].passportAddress)
        for (let j in history) {
            currentRecord = history[j]
            if (+currentRecord.key != NaN && currentRecord.eventType == "Updated" &&    // This last one shouldn't be included when implementing deletion of messages
                currentRecord.dataType == "String" && currentRecord.key != "username" && currentRecord.key != "password") {
                let fact = await historyFactReader.getString(currentRecord.transactionHash)
                if (!names.hasOwnProperty(fact.passportAddress)) {
                    names[fact.passportAddress] = await new vd.FactReader(web3, fact.passportAddress).getString(tesiEthereumAddress, "username")
                }
                if (fact.key != '') {       // First test messages in the blockchain did not saved correctly under the specified key
                    messages.push({
                        timestamp: +fact.key,
                        author: names[fact.passportAddress],
                        message: fact.value
                    })
                }
            }
        }
    }
    return messages
}

function hash(string) {     // I could pass a second parameter as the used hash algorithm, for future-proofing (and saving the used algorithm in the blockchain)
  return createHash('sha256').update(string).digest('hex');
}

/*function formatUsername(username) {
    //return Date.now() + "-" + username
    return Date.now()
}

function parseKey() {
    // WITH CURRENT LOGIC IT'S USELESS (SEE formatUsername())
}*/

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

app.post("/home", (req, res) => {       // Logic for creating passport or importing it and maintaining in session
    // Username must be unique in case of registration, so the user can avoid using its passport address and make it seamless with a normal chat
    if (req.session)
        req.session.logged = false
    
    if (req.body.todo == "Registrati") {
        // after having created the digital identity, you MUST set the whitelist to only allow the creator of the D.I. to write to it

        passportReader.getPassportsList(passportFactoryAddress).then(passports => {
            let shouldStop = false
            passports.forEach(function (pp) {
                new vd.FactReader(web3, pp.passportAddress).getString(tesiEthereumAddress, "username").then(uname => {
                    if (uname == req.body.username) {
                        shouldStop = true
                        res.redirect(409, '/register')
                        return
                    }
                })
            })
            if (shouldStop) return
            generator.createPassport(tesiEthereumAddress).then(txConf => {      // Need to change this pyramid with async/await functions
                sendTransaction(txConf).then(receipt => {
                    let passAddress = vd.PassportGenerator.getPassportAddressFromReceipt(receipt)
                    console.log("Passport created at " + passAddress + "!")
                    new vd.PassportOwnership(web3, passAddress).claimOwnership(tesiEthereumAddress).then(txC => {
                        sendTransaction(txC).then(rec => {
                            console.log("Passport ownership claimed!")
                            new vd.Permissions(web3, passAddress).setWhitelistOnlyPermission(true, tesiEthereumAddress).then(txD => {
                                sendTransaction(txD).then(rec => {
                                    console.log("Passport whitelisted!")
                                    let pWriter = new vd.FactWriter(web3, passAddress)
                                    pWriter.setString("username", req.body.username, tesiEthereumAddress).then(tData => {
                                        sendTransaction(tData).then(r => {
                                            console.log("Passport username set!")
                                            pWriter.setString("password", hash(req.body.password), tesiEthereumAddress).then(tConfiguration => {
                                                sendTransaction(tConfiguration).then(passReceipt => {
                                                    console.log("Passport password set, logging in...")
                                                    req.session.username = req.body.username
                                                    req.session.logged = true
                                                    req.session.address = passAddress
                                                    res.sendFile(path.join(__dirname, 'web/home.html'));
                                                })
                                            })
                                        })
                                    })
                                })
                            })
                        })
                    })
                })
            })
        })
    } else if (req.body.todo == "Login") {
        passportReader.getPassportsList(passportFactoryAddress).then(passports => {
            let found = false
            //passports.forEach((pp) => {
            for (let i = 0; i < passports.length; i++) {
                let psReader = new vd.FactReader(web3, passports[i].passportAddress)
                psReader.getString(tesiEthereumAddress, "username").then(foundUsername => {
                    if (foundUsername == req.body.username) {
                        found = true

                        // Comparing password hashes
                        psReader.getString(tesiEthereumAddress, "password").then(foundPassword => {
                            if (hash(req.body.password) == foundPassword) {
                                req.session.logged = true
                                req.session.username = req.body.username
                                req.session.address = passports[i].passportAddress
                                res.sendFile(path.join(__dirname, 'web/home.html'));
                            } else res.redirect(401, '/login')
                        })

                        return
                    }
                })
            }//)
            //if (!found) res.redirect(401, '/login')
            setTimeout(() => { if (!found) res.redirect(401, '/login') }, 10000)    // Terribile, ma la riga prima non funziona per asincronicità
        })
    } else res.redirect(400, '/')
})

app.get("/home", (req, res) => {
    if (isAuthenticated(req)) {
        res.sendFile(path.join(__dirname, 'web/home.html'))
    } else res.sendFile(path.join(__dirname, 'web/notAuth.html'))
})

app.post("/publishMessage", (req, res) => {     // AJAX method
    if (isAuthenticated(req)) {
        var msg = req.body.message
        if (msg && msg.length > 0 && msg.length <= 1024) {
            new vd.FactWriter(web3, req.session.address).setString(Date.now().toString(), msg, tesiEthereumAddress).then(txData => {
                sendTransaction(txData).then((rec, err) => {
                    if (!err) {
                        res.status(200).send(/* retrieveAllMessages() */{
                            timestamp: Date.now(),
                            username: req.session.username
                        })   // Uncommenting would be the best way, but very resource-intensive
                    } else {
                        res.sendStatus(500)
                    }
                })
            })
        } else res.send(400)
    } else res.send(403)
})

app.get("/logout", (req, res) => {
    if (isAuthenticated(req))
        //req.session.destroy()
        req.session.logged = false
    res.redirect(200, "/")  // Changed from default 301 status code
})

app.get("/retrieveMessages", async (req, res) => {    // Everybody can read without authentication, data is public anyway
    //if (isAuthenticated(req))
    res.send(await retrieveAllMessages())
})

app.listen(port, () => {
    console.log("Listening on port " + port)
    
    // Creating a passport for holding messages, if not already present. Useless now.
    passportReader.getPassportsList(passportFactoryAddress).then(passports => {
        if (passports.length == 0) {
            generator.createPassport(tesiEthereumAddress).then(txConfig => {
                web3.eth.accounts.signTransaction(txConfig, privateKey).then(signedTx => {
                    web3.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, receipt) {
                        if (!error) {
                            chatHolderAddress = vd.PassportGenerator.getPassportAddressFromReceipt(receipt)
                            var ownership = new vd.PassportOwnership(web3, chatHolderAddress)
                            ownership.claimOwnership(tesiEthereumAddress).then(txConf => {
                                web3.eth.accounts.signTransaction(txConf, privateKey).then(toSubmit => {
                                    web3.eth.sendSignedTransaction(toSubmit.rawTransaction, function(ownerErr, ownReceipt) {
                                        if (ownerErr) {
                                            console.log(ownerErr)
                                            exit()
                                        }
                                        console.log("Startup ended.")
                                    })
                                })
                            }).catch(err => {
                                console.log(err)
                                exit()
                            })
                        } else {
                            console.log("Error during the submission of the signed transaction, try again!")
                            console.log(error)
                            exit()
                        }
                    })
                }).catch(signingError => {
                    console.log(signingError)
                    exit()
                })
            }).catch(err => {
                console.log(err)
                exit()
            })
        } else {
            chatHolderAddress = process.env.CHAT_HOLDER_ADDRESS     // retrieving the list of Passport(s) created and obtaining the first is also valid
            console.log("Digital Identity for chat messages holder already created at " + chatHolderAddress)
            /*new vd.PassportOwnership(web3, chatHolderAddress).claimOwnership(tesiEthereumAddress).then(txConf => {
                sendTransaction(txConf).then((rec, err1) => {
                    if (err1) console.log(err1)
                    else console.log(rec)
                })
            })*/
            /*new vd.Permissions(web3, chatHolderAddress).setWhitelistOnlyPermission(true, tesiEthereumAddress).then(txConfig => {
                sendTransaction(txConfig).then((rec, err) => {
                    if (err) console.log(err)
                    else console.log(rec)
                })
            })*/
            console.log("Startup ended.")
        }
    }).catch(err => {
        console.log(err)
        exit()
    })
})


/* IMPORTANT POINTS:
1) One-Point-Failure --> my Node.js server, if taken down, would interrupt access to the chat (THIS IS AN ARCHITECTURAL PROBLEM OF C/S APPS????)
    Messages are always readable from Ethereum blockchain, even if my Node server is down
2) Impossibilità di verificare che l'utente crei identità multiple
3) I MESSAGGI SONO IN CHIARO PER SEMPLICITA' --> potrei farli privati ma molto oneroso (sarebbero basati su IPFS)
4) E' stato deciso di salvare tutto come Fatti NON privati: la password è salvata come hash, e viene controllato l'hash in fase di login
5) è stato usato il formato '(Timestamp): (Message)' per i messaggi, dato che ogni messaggio è salvato nell'indirizzo dello scrittore
6) NON RISPETTO LA GDPR --> L'UTENTE NON HA POSSIBILITA' DI RITIRARE I PROPRI DATI
*/