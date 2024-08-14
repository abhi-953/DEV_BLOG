import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import session from "express-session";
import { Strategy } from "passport-local";
import env from "dotenv";

env.config();

const app=express();
const port=8000;
const saltround=10;
const db=new pg.Client({
    user:process.env.USER,
    host:process.env.HOST,
    database:process.env.DATABASE,
    password:process.env.PASSWORD,
    port:process.env.PORT
});

app.use(session({
    secret:process.env.SECRET_KEY,
    resave:false,
    saveUninitialized: true,
    cookie:{
        maxAge: 100*60*60*24,
    }
}));

app.use(passport.initialize());
app.use(passport.session());

db.connect();
let login_checker="";

app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

let blogs=[{title:"hello",author:"hello",date:"aug,2024",body:"body"}];

async function get_blogs() {
    try{
    const result=await db.query("SELECT * FROM blog");
    blogs=result.rows;
    }
    catch(err){
        console.log(err);
    }
}
app.get("/",async (req,res)=>{
    console.log(process.env.DATABASE);
    await get_blogs();
    if(req.isAuthenticated()){    
        res.render("index.ejs",{
            blogs_list:blogs,
            authenticated:"true",
        });
    }
    else{
        res.render("index.ejs",{
            blogs_list:blogs,
        });
    }
})

app.get("/sign_in",(req,res)=>{
    res.render("login.ejs",{
        user:"",
        pass:"",
        checker:login_checker,
    });
})

app.get("/sign_up",(req,res)=>{
    res.render("register.ejs",{
        user:"",
        pass:"",
        check_u:"",
        email:"",
        check_e:"",
        ch1:"false",ch2:"false",ch3:"false",ch4:"false",
    });
})

app.post("/login",passport.authenticate("local",{
    successRedirect:"/",
    failureRedirect:"/sign_in",
}))

app.post("/register",async(req,res)=>{
    const username=req.body["username"];
    var password=req.body["password"];
    const email_id=req.body["email_id"];
    const result1=await db.query(`SELECT * FROM users where username='${username}'`);
    const result2=await db.query(`SELECT * FROM users where email_id='${email_id}'`);
    if(result1.rowCount!=0){  
        res.render("register.ejs",{
            user:req.body["username"],
            check_u:"Username already taken . Please choose another username . ",
            pass:req.body["password"],
            check_e:"",
            email:req.body["email_id"],
            ch1:'false',ch2:'true',ch3:'true',ch4:'true',
        })
    }
    else if(result2.rowCount!=0){
        res.render("register.ejs",{
            user:req.body["username"],
            check_u:"",
            pass:req.body["password"],
            check_e:"Email address already taken . Please provide another email address . ",
            email:req.body["email_id"],
            ch1:'true',ch2:'true',ch3:'true',ch4:'false',
        })
    }
    else{
        await bcrypt.hash(password,saltround,async (err,hash_password)=>{
            if(err){
                console.log('Error hashing password : ',err);
                res.render("register.ejs",{
                    user:"",
                    pass:"",
                    check_u:"",
                    email:"",
                    check_e:"",
                    ch1:"false",ch2:"false",ch3:"false",ch4:"false",
                });
            }
            else{
                try {
                    const result =await db.query(`INSERT INTO users (username, email_id, password) VALUES ('${username}','${email_id}','${hash_password}') RETURNING *;`);
                    const user=result.rows[0];
                    console.log('User added successfully:', result);
                    req.login(user,(err)=>{
                        console.log(err);
                        res.redirect("/");
                    })
                } catch (error) {
                    console.error('Error inserting user:', error);
                }
            }
        })
    }
})

app.get("/log_out",(req,res)=>{
    req.login(false,(err)=>{
        console.log(err);
        res.redirect("/");
    })
})

app.get("/my_blogs",async (req,res)=>{
    
    if(req.isAuthenticated()){    
        const curr_blogs=await db.query(`Select * from blog where author='${user.username}'`);
        res.render("index.ejs",{
            blogs_list:curr_blogs,
            authenticated:"true",
        });
    }
    else{
        res.render("index.ejs",{
            blogs_list:blogs,
        });
    }
})

passport.use(new Strategy(async function verify(usernameOrEmail,password,cb){
    try{
    const result=await db.query(`SELECT * FROM users WHERE username='${usernameOrEmail}' OR email_id='${usernameOrEmail}'`);
    if(result.rowCount!=0){
        const user=result.rows[0];
        const hash=user.password;
        bcrypt.compare(password,hash,(err,results)=>{
            if(err){
                return cb(err);
            }
            else if(results){
                login_checker="";
                console.log(1);
                return cb(null,user);
            }
            else{
                login_checker="The email address and/or password you specified are not correct .";
                res.render(null,false);
            }
        })
    }
    else{
        login_checker="There is no user with the given username or email address .";
        res.render(null,false);
    }
    }
    catch(err){
        console.log(err);
    }
}))

passport.serializeUser((user,cb)=>{
    cb(null,user);
})

passport.deserializeUser((user,cb)=>{
    cb(null,user);
})

app.listen(port,()=>{
    console.log("Server running on port : "+port);
})