var mysql = require("mysql");

var con = mysql.createConnection({
    host: "",
    user: "",
    password: "",
    database: ""
})

con.connect(function(err){
    if(err){
    console.log('Error connecting to Db')
    return
    }
    console.log('Connection established')
})