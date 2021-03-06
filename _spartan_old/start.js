'use strict';
var ask = require("./questions/questions.js");
var fs = require("fs");
var inquirer = require("inquirer");

var nq = [
  {
    type : 'list',
    name : 'type',
    message : "Q1. Application Type : What kind of application is this? \n * Tip: How will MOST users interact with your application?",
    default : 1,
    choices : ["Desktop", "Web", "Mobile", "Kiosk", "Embedded/IoT (Controller)", "API"]
  },
  {
    type : 'input',
    name : "hostname",
    message : "Q1.1 What is the application hostname? \n * Tip: This is the fully qualified domain name, like 'localhost' or 'www.google.com'",
    default : "localhost",
    when : function (answers){
      var ask;
        if (answers.type == "Desktop" || answers.type == "Embedded/IoT (Controller)"){
          ask = false;
        } else {
          ask = true;
        }
      return ask;
    }
  },
  {
    // why ask this? Because the response may change the response headers that are set on the application
    type : 'confirm',
    name : 'exposure',
    message : "Q2. Application Accessibility : Will the application be accessible over the Internet? \n * Tip : if this is a possibility in the future, say 'Yes'",
    default : true,
    validate : function (answers) {
      if (answers.exposure !== 'Y' || answers.exposure !== 'N' || answers.exposure !== 'yes' || answers.exposure !== 'no'){
        return "Invalid input. Please try again."
      } else {
        return answers.exposure
      }
    },
    filter: Boolean
  },
  {
    type : 'confirm',
    name : 'access',
    message : "Q3. User Sign-in : Will your application require any kind of sign-in or authentication functionality in order to utilize certain routes or services? \n * Tip : if this is a possibility in the future, say 'Yes'",
    default : true
  },
  {
    type : 'list',
    name : 'sessions',
    message : "Q4. Sessions : Will the application have predetermined session lengths or can users be logged in indefinitely? \n * Tip : if this is a possibility in the future, say 'Yes'",
    default : 0,
    choices : ["User sessions have a set timeout", "Users can be logged in indefinitely", "Other session management scheme outside application"]
  },
  {
    type : 'input',
    name : 'sessionLength',
    message : "Q4.1 What is the default session length (TTL) in seconds?",
    default : 600,
    when : function(answers){
      return answers.sessions == "User sessions have a set timeout"
    },
    filter : Number
  },
  {
    type : 'confirm',
    name : 'secureTransport',
    message : "Q5. Connection Security : Does the application force secure transport (HTTPS, SSH, etc) throughout? \n * Tip : if your application responds to requests over non-secure means on any component say 'No'",
    default : true
  },
  {
    type : 'list',
    name : 'content',
    message : "Q6. Content Acquisition : Is all of the data/content generated and processed within your application? \n * Tip : if you plan to use external APIs at any point, choose the second answer. You'll have the opportunity to specify these sources later",
    default : 1,
    choices : [
      "All of the data and content comes from sources that I own or control",
      "Some of the data and content comes from sources that I don't own or control"
    ],
    when : function (answers){
      var ask;
        if (answers.type == "API" || answers.type == "Embedded/IoT (Controller)"){
          ask = false;
        } else {
          ask = true;
        }
      return ask;
    }
  },
  {
    type : 'editor',
    name : 'contentSources',
    message : "Q6.1. Content Sources: Sweet! What are those sources? (JSON)\n * Tip: While specificity is more secure, it's also limiting. Use '*' operand for more flexible options. Use the formatting in the default",
    default : '{"default" : ["self", "www.redit.com"], "media" : ["self", "*.pinterest.com", "https://*.flickr.com", "ftp://video.domain.com:21"], "images" : ["self"], "styles" : ["*.bootstrap.com", "https://materializecss.com", "self"], "scripts" : ["self"], "frames" : ["none"]}',
    when : function(answers){
      var floop =  "Some of the data and content comes from sources that I don't own or control";
      return answers.content == floop;
    },
    filter : function(value, e){
      try {
        return JSON.parse(value);
      }
      catch (e) {
       return "Unable to successfully format this object => " + e;
      }
    }
  },
  {
    type : 'confirm',
    name : 'forms',
    message : "Q7. Forms: Will your application utilize input forms for data collection?\n * Tip : Consider collection of ratings, feedback, reviews, search, profiles etc...",
    default : true
  },
  {
    //why ask about cache? Because some generated data and user-provided data may be considered sensitive, and we want to make sure that we DON'T cache that information
    type : 'confirm',
    name : 'cacheStrategy',
    message : "Q8. Caching Strategy: Do you have any intention of introducing a caching layer or using a Content Delivery Network (CDN)?\n * Tip : If this is a possibility in the future, choose 'yes'.",
    default : true
  },
  {
    type : 'input',
    name : 'cacheTtl',
    message : "Q8.1. Cache Time To Live (TTL): For MOST public data generated by the application, how long (in seconds) should this information be cached?\n * Tip : Shorter TTLs will require more requests of the application origin; longer TTLs may result in stale, invalid data. You can override this on a per-route basis",
    default : 15780000,
    when : function(answers){
      return answers.cacheStrategy
    },
    validate: function(value) {
      var valid = !isNaN(parseFloat(value));
      return valid || 'Please enter a number';
    },
    filter: Number
  },
  {
    type : 'input',
    name : 'deployment',
    message : "Q9. Application Hosting : Where will application be deployed & hosted? \n * Tip : Looking for GCP, AWS, Rackspace, Heroku or similar",
    default : "locally hosted",
    //need a validation for this
    filter : String
  },
  {
    type : 'input',
    name : 'logging',
    message : "Q10. Logging and Auditing: Where will application logs be stored? (absolute path)",
    default : '/var/log/appName/'
  },
];

var confirmPolicy = [{
    type : 'confirm',
    name : 'confirmValues',
    message : 'Is this ok?',
    default : true
  }];

var confirmDelete = [{
    type : 'confirm',
    name : 'confirmDelete',
    message : 'Are you sure? This action is not reversable.',
    default : true
  }];

var confirmDefault = [{
    type : 'confirm',
    name : 'confirmDefault',
    message : 'Are you sure? This will completely overwrite your existing default policy and this action is not reversable.',
    default : true
  }];

var confirmPkgRemoval = [{
    type : 'confirm',
    name : 'confirmPkgRemoval',
    message : 'These packages will be uninstalled locally and will be removed from package.json.',
    default : true
  }];
/*
1. Ask the user the questions and store in a temporary variable, tmp. Should this be a function?
2. Ask the user if this is ok
  - if it is ok, then begin the process of transposing the answers
  - if it is not ok, then ask the users the questions again
*/

async function ans () {
    try {
        var a = ask.question(nq);
      if (typeof a == 'object'){
        console.log(typeof a);
      } else {
        console.log ("There was an error");
      }
    } catch (e){
      console.log(e);
    }
    return a;
}

async function confirm () {
  var foo = await ask.question(confirmPolicy);
  try {
    if (foo.confirmValues){
      console.log("writing policy...\n");
      return foo.confirmValues;
    } else {
      console.log("so sad!");
      return foo.confirmValues;
    }
  } catch (err) {
    console.log("Sad Face! :-( something went wrong writing your policy\n");
    console.log (err.code, err.path);
  }
}

async function deleteSecurity () {
  var bar = await ask.question(confirmDelete);
  try {
    return bar.confirmDelete;
  } catch (err) {
    console.log("Sad Face! :-( something went wrong deleting the policy\n");
    console.log (err.code, err.path);
  }
}

async function changeDefault() {
  var moo = await ask.question(confirmDefault);
  try {
    return moo.confirmDefault;
  } catch (err) {
    console.log("Sad Face! :-( something went wrong overwriting the default policy\n");
    console.log (err.code, err.path);
  }
}

async function confirmPkgRemove() {
  var cow = await ask.question(confirmPkgRemoval);
  try {
    return cow.confirmPkgRemoval;
  } catch (err) {
    console.log("Sad Face! :-( something went wrong removing these packages\n");
    console.error(err.code, err.path);
  }
}

module.exports.ans = ans;
module.exports.confirm = confirm;
module.exports.deleteSecurity = deleteSecurity;
module.exports.changeDefault = changeDefault;
module.exports.confirmPkgRemove = confirmPkgRemove;
