'use strict'
var winston = require('winston');
var async = require('async');
var archiver = require('archiver');
var async = require('async');
var fs = require('fs');
var multer = require('multer')
var path = require('path');

var mongoose = require('mongoose');
var CM = mongoose.model('ClassMaterial');

//Instanciate winston
var logger = new(winston.Logger)({
                  transports: [
                      new (winston.transports.Console)(),
                      new (winston.transports.File)({ filename: 'error.log' })
                  ]
              })

//File destination path
var uploadDir = path.join(__dirname, '../uploads/class-materials');

//set the multer storage engine
var storage = multer.diskStorage({
  //set file destination
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  //Rename file to fieldname+Date.now() i.e file uploaded date.
   filename: function (req, file, cb) {//rename file 
    console.log("I was here filename");
    cb(null, file.fieldname+'-'+Date.now()+'-'+path.extname(file.originalname));
  }
});


//Upload options
var upload = multer({
  //Add storage engine
  storage: storage,
  //Filter file upload. File allowed [.pdf, .jpg, .docs and .txt];
  fileFilter: function(req, file,cb ){
      console.log("Filter was here");
      if(path.extname(file.originalname)=='.pdf'){
        return cb(null, true);
      }else{
         cb(new Error('File type not allowed'))
      }

  }
}).array('materials', 12);//set fieldname and total numbers of file

/** Post Materials 
  * @param request object
  * @param response object
  * @param callback function
  */
exports.postMaterials = function(/*Object*/req, /*Object*/res, /*Function*/callback){
    //Get file request and add file to disk
    upload(req, res, function(err) {
        if(err) {
            console.log(err);
            return callback(err);
        }

        //Zip file after adding to disk
        //Create a file to stream file archieve data to
        var archiveFile = uploadDir+'/'+req.body.courseCode+"-"+Date.now()+".zip";
        var output = fs.createWriteStream(archiveFile);
        var archive = archiver('zip');
        //listen for all archieve data to be written
        output.on('close', function(){
            console.log(archive.pointer() + ' total bytes');
            console.log('archiver has been finallized');
                var newCM = new CM();
                newCM.courseTitle = req.body.courseTitle;
                newCM.courseCode = req.body.courseCode;
                newCM.level = req.body.level;
                newCM.topic = req.body.topic;
                newCM.description = req.body.description;
                newCM.type = req.body.type;
                newCM.downloadLink = archiveFile;
                newCM.uploadedBy = req.body.uploadedBy
                
              //Foreach uploaded file
              async.each(req.files, function(file, cb){
                 //delete the files after zipping
                fs.unlink(uploadDir+'\/'+file.filename, function(err){
                      if (err) {console.log(err)}
                 });
              });
              //Save file details to DB 
              newCM.save(function(err){
                  if(err){
                       console.log(err)
                       return callback(err)
                  }
              });
              return callback();
        });
        //At any error return callback
        archive.on('error', function(err){
            return callback(err);
        });
        //Pipe archive data to file
	      archive.pipe(output);
        //Foreach uploaded file
        async.each(req.files, function(file, cb){
            //apend a file
            archive.file(uploadDir+'/'+file.filename, {name: file.filename});
        });
       //finalize the archive (ie we are done appending files but streams have to finish yet)
       archive.finalize();
  
  });
}
/** Update Materials details
  *@params request
  *@params callback function
*/
exports.updateMaterial = function(/*object*/req, /*function*/callback){ 
   //Details permitted to updated
   var updatedInfo = {    
        courseCode:req.body.courseCode,
        topic:req.body.topic,
        description: req.body.description,
        type: req.body.type
    }
    //Update materials with the id
    CM.update({_id: req.params.id}, {$set:updatedInfo}, function(err){
            if(err)
                //throw err
                return callback("Could not update info at this time", null);
            return callback(null, "Successfully updated..");
    });
}
/**Delete a material
  *@params request 
  *@params callback function
*/
exports.deleteMaterial = function(/*object*/req, /*function*/callback){
    //Delete material with the id
    CM.findOneAndRemove({_id:req.params.id},function(err, doc){
            if(err){
                if (err){
                    return  callback("Could not delete material at this time", null);     
                }
            }
            //Remove material from the disk
            fs.unlink(doc.downloadLink, function(err){
                if (err){
                    return  callback("Could not delete material at this time", null);     
                }
            });
            return callback(null, "Material deleted")
    })
}
/**Get all Materials
    *@req request object 
    *@params callback function
  */
exports.getMaterials = function(req/*object*/, /*function*/callback){
    //Find all materials
    var userCourses = JSON.parse(req.query.userCourses);
    CM.find({courseCode:{$in:userCourses}}, function(err, docs){
        if(err){
            return callback({state: 'failed', mesg: "Unable to retrive materials at this time."}, null)
        }
        return callback(null,{state: 'success', docs: docs});
    });
}
/**Get materials by id
  *@param material id
  *@param callback function
*/
exports.getMaterialsById = function(/*string*/id, /*function*/callback){
    //Find material with id
    CM.findById(id,function(err, material){
        if(err){
            console.log(err)
            return callback('Could not retrive materials at this time', null)
        }
        return callback(null, material);
	})
}
