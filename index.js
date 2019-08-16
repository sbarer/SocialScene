const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const { Pool } = require('pg');
const request = require('request')
const pool = new Pool({
  // connectionString: process.env.DATABASE_URL,
  // ssl: true
  user: 'postgres',
  password: 'root',
  host: 'localhost',
  database: 'simonbarer'
});

var user = {fname:null,lname:null,email:null}
var movieobj = {id:null, title:null ,overview:null ,date:null ,poster:null ,language:null ,vote:null ,rating:null}
var recent_review_data = {reviews: null, movieobj: null}
var top_review_data = {reviews: null, movieobj: null}


const app = express()
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json());
app.use(express.urlencoded({extended:false}));

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// app.get('/', (req, res) => res.render('pages/index'))
app.get('/', (req, res) => res.render('pages/app'))

app.get('/login', (req, res) => res.render('pages/login',{val:'none'}))
app.get('/register', (req, res) => res.render('pages/register',{val:'none'}))
app.get('/tmdb',(req,res)=>res.render('pages/tmdb'))
app.get('/user', async (req,res)=>{
  const client = await pool.connect()
  const result = await client.query("select * from (SELECT Distinct on (id) * FROM review where email='" + user.email + "' order by id, date_time DESC) as agg order by date_time DESC;")
  var recent_reviews =  await client.query("select * from (select distinct on (id) * from review where email in (select f.email2 from friends f where f.email1 = '" + user.email + "' and '" + user.email + "' in (select ff.email2 from friends ff where ff.email1 != '" + user.email + "')) order by id, date_time ASC) as agg2 order by date_time DESC;")
  var top_reviews = await client.query("select * from (select distinct on (agg_r.id) * from review r right outer join (select id, avg(rating) as avg_rating from review where email in (select f.email2 from friends f where f.email1 = '" + user.email + "' and '" + user.email + "' in (select ff.email2 from friends ff where ff.email1 != '" + user.email + "')) group by id) as agg_r on agg_r.id = r.id order by agg_r.id, avg_rating ASC) as rr order by rr.avg_rating DESC;")
  var base_top_reviews = await client.query("select * from (select distinct on (agg.id) *  from review left outer join (select id, avg(rating) as avg_rating from review group by id) as agg on agg.id = review.id)as rr order by rr.avg_rating DESC;")
  // unescape escaped fields for viewing in html
  for (var i = 0; i < recent_reviews.rows.length; i++) {
    recent_reviews.rows[i].overview = unescape(recent_reviews.rows[i].overview)
    recent_reviews.rows[i].title = unescape(recent_reviews.rows[i].title)
  }
  for (var i = 0; i < top_reviews.rows.length; i++) {
    top_reviews.rows[i].overview = unescape(top_reviews.rows[i].overview)
    top_reviews.rows[i].title = unescape(top_reviews.rows[i].title)
  }
  for (var i = 0; i < base_top_reviews.rows.length; i++) {
    base_top_reviews.rows[i].overview = unescape(base_top_reviews.rows[i].overview)
    base_top_reviews.rows[i].title = unescape(base_top_reviews.rows[i].title)
  }
  recent_review_data.reviews = recent_reviews.rows
  top_review_data.reviews = top_reviews.rows
  // console.log(review_data.reviews)
  const results = { 'results': (result) ? result.rows : null, reviews: (recent_review_data) ? recent_review_data.reviews : null, top_reviews: (top_review_data) ? top_review_data.reviews : null, base_top_reviews: (base_top_reviews) ? base_top_reviews.rows : null};
  results.user = user
  res.render('pages/user',results)
})


app.get('/logout',(req,res)=>{
  console.log("User logout '" + user.email + "'")
  user.fname = null
  user.lname = null
  user.email = null
  res.redirect('/')
})

app.get('/edituser', async (req, res) => {
    try {
      const client = await pool.connect()
      const result = await client.query("SELECT * FROM users where email= '" + user.email + "';");
      var reviews = await client.query("select * from review where email = '" + user.email + "'order by date_time DESC;");
      // unescape escaped fields for viewing in html
      for (var i = 0; i < reviews.rows.length; i++) {
        reviews.rows[i].title = unescape(reviews.rows[i].title)
        reviews.rows[i].review = unescape(reviews.rows[i].review)
      }
      const results = { 'results': (result) ? result.rows[0] : null, 'reviews': (reviews.rows) ? reviews.rows : null, };
      res.render('pages/edituser', results);
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
app.get('/details', (req,res)=>{
  console.log("redirected to summary page")
  res.render('pages/summary',recent_review_data)
})

app.get('/friends', async (req,res) => {
  try {
    // console.log(user)
    const result  = await pool.query("select f.fname1, f.lname1, f.email1 from friends f where f.email2 = '" + user.email + "' and '" + user.email + "'  not in (select ff.email1 from friends ff where ff.email2 = f.email1);")    
    // console.log(result)
    const results = { 'results': (result) ? result.rows : null, user: user};
    res.render('pages/friends', results);
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
})

app.get('/friendlist', async (req,res) => {
  try {
    // console.log(user)
    const result  = await pool.query("select f.fname2, f.lname2, f.email2 from friends f where f.email1 = '" + user.email + "' and '" + user.email + "'  in (select ff.email2 from friends ff where ff.email1 = f.email2);")    
    // console.log(result.rows)
    const results = { 'results': (result) ? result.rows : null, user: user};
    res.render('pages/friendlist', results);
  } catch (err) {
    console.error(err);
    res.send("Error " + err);
  }
})

app.post('/register', async (req, res) => {
  try {
    const client = await pool.connect()
    var data = "('" + req.body.fname + "','"  + req.body.lname + "','" + req.body.email + "','" + req.body.password + "');"
    const result = await client.query("insert into users values " + data);
    user.fname = req.body.fname
    user.lname = req.body.lname
    user.email = req.body.email
    res.redirect('/user')
    client.release();
  }
  catch (err) {
    console.error("Email exists: Primary key error");
    res.render('pages/register',{val:'block'})
  }
})

//  Abel  | Thomas | a@asd.com | asd123
app.post('/login', function( req, res) {
  var data = "'" + req.body.login_email + "';"
  pool.query("select fname,lname,password from users where email= " + data, function(err,table){
    if (table.rows.length == 1) {
      var result = (table.rows[0].password==req.body.login_pass);
      if ( result ){
        // console.log("User found '" + req.body.login_email + "' || result " + result )
        user.fname = table.rows[0].fname
        user.lname = table.rows[0].lname
        user.email = req.body.login_email
        res.redirect('/user')
      }
      else{
        console.log("User found '" + req.body.login_email + "' || result " + result )
        res.render('pages/login',{val:'block'})
      }
    }
    else {
      console.log("User not found" )
      res.render('pages/login',{val:'block'})
    }
  })
});


app.post('/searchfriends', async (req,res) => {
  console.log('entered friend post')
  // console.log(user)

  var fname = "'%" + req.body.fname + "%'"
  var lname = "'%" + req.body.lname + "%'"


  const result  = await pool.query("select fname,lname,email from users where fname ilike" + fname + "and lname ilike " + lname + " and email not in (select f.email2 from friends f where f.email1 = '" + user.email + "') order by lower(fname) ASC;")
  const friends  = await pool.query("select f.fname2, f.lname2, f.email2 from friends f where f.email1 = '" + user.email + "' and '" + user.email + "'  in (select ff.email2 from friends ff where ff.email1 = f.email2);")
  // console.log(result)
  // console.log(friends)

  const results = { 'results': (result) ? result.rows : null, 'user': user, 'friends': (friends) ? friends.rows : null};
  res.render('pages/searchfriends', results) 
  
})

app.post('/edituser', async (req, res) => {
  try {
    const client = await pool.connect()
    var data = "fname='" + req.body.fname + "',lname='"  + req.body.lname + "',password='" + req.body.password + "'"
    const result = await client.query("update users set " + data + " where email= '" + user.email + "';");
    console.log("User Edited")
    user.fname = req.body.fname
    user.lname = req.body.lname
    res.redirect('/user')
    client.release();
  }
  catch (err) {
    console.error(err);
    res.render('pages/edituser')
  }
})

//tmdb api start
app.post('/searchtv',async(req,res)=>{
  console.log('entered a search value')
  var key = req.body.keyword;
  var front = 'https://api.themoviedb.org/3/search/tv?api_key=7558289524aade3e869fbafc8bb9e8fd&language=en-US&query=';
  var end = '&page=';
  var pg = req.body.pg;
  var url = front + key + end + pg;    //concatenating url
  console.log('fetching data from',url);
  request({
  //fetching data from the url
    url: url,
    json: true
  }, function (error, response, body) {
    //body is going to store json string
    if(!error){
      body.key = key;
      // console.log(body);
      res.render('pages/searchtv',body);
    }
  })
})
app.post('/prevtv',async(req,res)=>{
  console.log('entered a search value')
  var key = req.body.keyword_prev;
  var front = 'https://api.themoviedb.org/3/search/tv?api_key=7558289524aade3e869fbafc8bb9e8fd&language=en-US&query=';
  var end = '&page=';
  var pg = req.body.pg_prev;
  var url = front + key + end + pg;    //concatenating url
  console.log('fetching data from',url);
  request({
  //fetching data from the url
    url: url,
    json: true
  }, function (error, response, body) {
    //body is going to store json string
    if(!error){
      body.key = key;
      // console.log(body);
      res.render('pages/searchtv',body);
    }
  })
})

app.post('/searchmv',async(req,res)=>{
  console.log('entered a search value')
  var front = 'https://api.themoviedb.org/3/search/movie?api_key=7558289524aade3e869fbafc8bb9e8fd&language=en-US&query=';
  var key = req.body.keyword;
  var end = '&page=';
  var pg = req.body.pg
  var url = front + key + end + pg;    //concatenating url
  console.log('fetching data from',url);
  request({
  //fetching data from the url
    url: url,
    json: true
  }, function (error, response, body) {
    //body is going to store json string
    if(!error){
      body.key = key;

      res.render('pages/searchmv', body);
    }
  })
})
app.post('/prevmv',async(req,res)=>{
  console.log('entered a search value')
  var front = 'https://api.themoviedb.org/3/search/movie?api_key=7558289524aade3e869fbafc8bb9e8fd&language=en-US&query=';
  var key = req.body.keyword_prev;
  var end = '&page=';
  var pg = req.body.pg_prev;
  var url = front + key + end + pg;    //concatenating url
  console.log('fetching data from',url);
  request({
  //fetching data from the url
    url: url,
    json: true
  }, function (error, response, body) {
    //body is going to store json string
    if(!error){
      body.key = key;
      // console.log(body);
      res.render('pages/searchmv',body);
    }
  })
})


app.post('/details', async (req,res)=>{  
  console.log("entered details")
  const client =  await pool.connect()  
  const reviews  =  await client.query("select * from review where id = '" + req.body.id + "' and email = '" + user.email + "' or id = '" + req.body.id + "' and email in (select f.email2 from friends f where f.email1 = '" + user.email + "' and '" + user.email + "' in (select ff.email2 from friends ff where ff.email1 != '" + user.email + "')) order by date_time ASC;")
  // unescape
  for (var i = 0; i < reviews.rows.length; i++) {
    reviews.rows[i].review = unescape(reviews.rows[i].review)
  }

  movieobj.id = req.body.id,
  movieobj.title = req.body.title,
  movieobj.overview = req.body.overview,
  movieobj.date = req.body.date,
  movieobj.poster = req.body.poster,
  movieobj.language = req.body.language
  movieobj.vote = req.body.vote,
  movieobj.rating = req.body.rating



  recent_review_data = {reviews: reviews.rows, movieobj: movieobj}
  

  // console.log("data.all_reviews.rows:\n", review_data)
  res.render('pages/summary', recent_review_data)
})
// tmdb api end

app.post('/rateuser', async (req, res) => {
  try {
    // connect to database
    const client = await pool.connect()
    // Insert new review into review table
    var data = "('" + user.email + "', '" + movieobj.id + "', '" + escape(req.body.title) + "', " + req.body.rating + " , '" + escape(req.body.review) + "', '" + user.fname + "', '" + user.lname + "', current_timestamp, '" + movieobj.poster + "', '" + escape(movieobj.overview) + "', '" + movieobj.date + "', '" + movieobj.rating + "');"
    const result = await client.query("insert into review values " + data);
    // update review_data.reviews object now that a new review has been entered
    var reviews =  await client.query("select * from review where id = '" + movieobj.id + "' and email = '" + user.email + "' or id = '" + movieobj.id + "' and email in (select f.email2 from friends f where f.email1 = '" + user.email + "' and '" + user.email + "' in (select ff.email2 from friends ff where ff.email1 != '" + user.email + "')) order by date_time ASC;")
    // unescape escaped clauses
    var escapedReviews = reviews
    for (var i = 0; i < reviews.rows.length; i++) {
      escapedReviews.rows[i].title = unescape(reviews.rows[i].title)
      escapedReviews.rows[i].review = unescape(reviews.rows[i].review)
      escapedReviews.rows[i].overview = unescape(reviews.rows[i].overview)
    }

    // console.log(escapedReviews.rows)

    recent_review_data.reviews = escapedReviews.rows

    // refresh page so review appears
    res.redirect('/details')
    client.release();
  }
  catch (err) {
    console.error("Error: " + err);
    res.redirect('/details')
  }
})


app.post('/FriendRequest', async (req, res) => {
  try {
    console.log("entered sendFriendRequest in index.js")
    // console.log(req.body)
    var value = req.body.value
    const client = await pool.connect()
    var data1 = "('" + req.body.email1 + "','"  + req.body.fname1 + "','" + req.body.lname1 + "', "
    var data2 = "'" + req.body.email2 + "','"  + req.body.fname2 + "','" + req.body.lname2 + "');"

    if (value == "Send Friend Request") {
      // ADD REQUEST TO FRIENDS TABLE IN DB
      console.log("entered search friends db")
      // search friend db to ensure that the request hasnt been submitted already
      const search = await client.query("select * from friends where email1 = '" + req.body.email1 + "' and email2 = '" + req.body.email2 + "';")
      // console.log("search: ", search)
      if (search.rowCount != 0) {
        // then it does exist, so do nothing
        console.log("entered rowcount!=0")
        return
      }
      else {
        // then the request doesnt exist yet, so insert it into the table
        console.log("entered insert into friends db")
        const result = await client.query("insert into friends values " + data1 + data2);
      }
    }
    else {
      // VALUE == "Cancel Request"
      // REMOVE FRIEND REQUEST FROM FRIENDS TABLE IN DB
      console.log("entered delete from friends db")
      const result = await client.query("delete from friends where email1 = '" + req.body.email1 + "' and email2 = '" + req.body.email2 + "';");
    }
  }
  catch (err) {
    res.send("Error " + err);
  }
})

app.post('/FriendRequest2', async (req, res) => {
  try {
    console.log("entered sendFriendRequest2 in index.js")
    // console.log(req.body)
    var value = req.body.value
    const client = await pool.connect()
    var data1 = "('" + req.body.email1 + "','"  + req.body.fname1 + "','" + req.body.lname1 + "', "
    var data2 = "'" + req.body.email2 + "','"  + req.body.fname2 + "','" + req.body.lname2 + "');"

    if (value == "Send Friend Request") {
      // ADD REQUEST TO FRIENDS TABLE IN DB
      console.log("entered search friends db")
      // search friend db to ensure that the request hasnt been submitted already
      const search = await client.query("select * from friends where email1 = '" + req.body.email1 + "' and email2 = '" + req.body.email2 + "';")
      // console.log("search: ", search)
      if (search.rowCount != 0) {
        // then it does exist, so do nothing
        console.log("entered rowcount!=0")
        return
      }
      else {
        // then the request doesnt exist yet, so insert it into the table
        console.log("entered insert into friends db")
        const result = await client.query("insert into friends values " + data1 + data2);
      }
    }
    else {
      // VALUE == "Cancel Request"
      // REMOVE FRIEND REQUEST FROM FRIENDS TABLE IN DB
      console.log("entered delete from friends db")
      const result = await client.query("delete from friends where email1 = '" + req.body.email1 + "' and email2 = '" + req.body.email2 + "';");
      const result2 = await client.query("delete from friends where email1 = '" + req.body.email2 + "' and email2 = '" + req.body.email1 + "';");
    }
  }
  catch (err) {
    res.send("Error " + err);
  }
})

app.post('/FriendRequestResponse', async (req, res) => {
  try {
    // console.log("entered FriendRequestResponse in index.js")
    // console.log(req.body)
    var value = req.body.value
    const client = await pool.connect()
    var data1 = "('" + req.body.email1 + "','"  + req.body.fname1 + "','" + req.body.lname1 + "', "
    var data2 = "'" + req.body.email2 + "','"  + req.body.fname2 + "','" + req.body.lname2 + "');"

    if (value == "Accept") {
      // ADD REQUEST TO FRIENDS TABLE IN DB
        console.log("entered insert into friends db")
        const result = await client.query("insert into friends values " + data1 + data2);
    }
    else {
      // VALUE == "Reject"
      // REMOVE FRIEND REQUEST FROM FRIENDS TABLE IN DB
      console.log("entered delete from friends db")
      const result = await client.query("delete from friends where email1 = '" + req.body.email2 + "' and email2 = '" + req.body.email1 + "';");
    }
  }
  catch (err) {
    res.send("Error " + err);
  }
})


app.listen(PORT, () => console.log(`Listening on ${ PORT }`))
module.exports = app;


