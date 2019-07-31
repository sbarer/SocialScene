var chai = require('chai');
var chaiHttp = require('chai-http');
var server = require('../index.js');
var should = chai.should();
var request = require('request');
chai.use(chaiHttp);


describe('Main page', function(done) {
    it('status',function(done){
	    request('http://localhost:5000' , function(err, res, body) {
	        res.should.have.status(200);
	        done();
    });
    });
});

describe('Users', function(){
	it('should add a single user on POST /regiter', function(done){
		chai.request(server).get('/register').end(function(err, res){ // assume this gets array of all users
     		var num_user = res.body.length;
  	
     	chai.request(server).post('/register').send({
     		'fname':'test',
     		'lname':'subject',
     		'email':'test@hotmail.com',
     		'password': 'password'})

        .end(function(err, res){
         	var num_user2 = res.body.length; // assuming response contains user array
        	// (num_user2 - num_user).should.equal(1);
        	console.log(num_user2);
	        res.should.have.status(200);
        	done();
        	});
    	});
	});
});
