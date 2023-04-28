require('dotenv').config()

const express = require('express')
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
const generator = new vd.PassportGenerator(web3, passportFactoryAddress)
let chatHolderAddress

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

async function sendTransaction(txConfig) {
    var signedTx = await web3.eth.accounts.signTransaction(txConfig, privateKey)
    web3.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, receipt) {
        if (!error) {
            return receipt
        } else {
            console.log("Error during the submission of the signed transaction, try again!")
            console.log(error)
            //exit()
            return null
        }
    })
}

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
    
    if (req.body.todo == "Registrati") {
        if (req.session)
            req.session.destroy()
        
        // check if username does not already exist TODO
        // after having created the digital identity, you MUST set the whitelist to only allow the creator of the D.I. to write to it TODO
        req.session.username = req.body.username
        req.session.logged = true
        res.sendFile(path.join(__dirname, 'web/home.html'));
    } else if (req.body.todo == "Login") {

        req.session.logged = true
        res.sendFile(path.join(__dirname, 'web/home.html'));
    } else res.send(400)
})

app.get("/home", (req, res) => {
    if (isAuthenticated(req)) {
        res.sendFile(path.join(__dirname, 'web/home.html'))
    } else res.sendFile(path.join(__dirname, 'web/notAuth.html'))
})

app.post("/publishMessage", (req, res) => {
    // AJAX method

    if (isAuthenticated(req)) {
        // Save into blockchain the message
        res.send(200)
    } else res.send(403)
})

app.get("/logout", (req, res) => {
    if (isAuthenticated(req))
        req.session.destroy()
    res.redirect("/")
})

app.listen(port, () => {
    console.log("Listening on port " + port)
    
    // Creating a passport for holding messages, if not already present.
    passportReader.getPassportsList(passportFactoryAddress).then(passports => {
        if (passports.length == 0) {
            generator.createPassport(tesiEthereumAddress).then(txConfig => {
                web3.eth.accounts.signTransaction(txConfig, privateKey).then(signedTx => {
                    web3.eth.sendSignedTransaction(signedTx.rawTransaction, function(error, receipt) {
                        if (!error) {
                            console.log("------ RECEIPT ------")
                            console.log(receipt)
                            console.log("---------------------")
                            chatHolderAddress = vd.PassportGenerator.getPassportAddressFromReceipt(receipt)
                            console.log("The address of the chat messages holder is " + chatHolderAddress)
                            var ownership = new vd.PassportOwnership(web3, chatHolderAddress)
                            ownership.claimOwnership(tesiEthereumAddress).then(txConf => {
                                web3.eth.accounts.signTransaction(txConf, privateKey).then(toSubmit => {
                                    web3.eth.sendSignedTransaction(toSubmit.rawTransaction, function(ownerErr, ownReceipt) {
                                        if (!ownerErr)
                                            console.log("Ownership claimed, too!")
                                        else {
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
            chatHolderAddress = process.env.CHAT_HOLDER_ADDRESS
            console.log("Digital Identity for chat messages holder already created at " + chatHolderAddress)
            console.log("Startup ended.")
        }
    }).catch(err => {
        console.log(err)
        exit()
    })
    // End of creation of passport or its retrieving.
})


/* IMPORTANT POINTS:
1) One-Point-Failure --> my Node.js server, if taken down, would interrupt access to the chat (THIS IS AN ARCHITECTURAL PROBLEM OF C/S APPS????)
    Messages are always readable from Ethereum blockchain, even if my Node server is down
2) No verification of multiple identities by same user
3) CHIUNQUE PUO' SCRIVERE SU UNA IDENTITA' DIGITALE (SOLO I FACTS PRIVATI RICHIEDONO DI ESSERE OWNER) --> NON SI PUO' DARE PER SCONTATA L'IDENTITA'
4) I MESSAGGI SONO IN CHIARO PER SEMPLICITA' --> potrei farli privati ma che sbatto (sarebbero basati su IPFS)
5) Proseguimento del punto 4: SOLO I DATI DEGLI UTENTI SONO PRIVATI (OWNERSHIP SOLO DAL SERVER (???!!!), ENCRYPTION KEY MANDATA DAL CLIENTE AL LOGIN)
   Ciò significa che potenzialmente il server può leggere username/password (se non hashata, ma io la hasho), ma gli utenti devono avere fiducia che io non lo faccia.
   Faccio così per evitare agli utenti lo sbatto di avere proprie chiavi private e pubbliche e di avere un account ETH con un saldo non nullo (dato che claimare ownership costa) 
   e tutto il resto come descritto nella tesi al terzo capitolo
   SOLUZIONE DA VERIFICARE: BANALMENTE, SE SALVO TUTTO COME FATTI -NON- PRIVATI (MA LA PASSWORD CON HASH) RISOLVO LA COSA CIRCA
*/