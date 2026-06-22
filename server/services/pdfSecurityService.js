const { spawn } = require("child-process");
const { path } = require("path");
const { fs } = require("fs");

const editLockPdf = (inputPath, outputPath) => {
    return new Promise((resolve,reject) => {
        const password = process.env.OWNER_PASSWORD;
        
        if(!password){
            console.log('Further processing without password');
        }

        const args = [
            '--encrypt',
            '',
            password,
            '256',
            '--modify=none',
            "--extract=n",
            "--anonate=n",
            "--form=n",
            "--print=low",
            inputPath,
            outputPath
        ];

        const qpdf = spawn("qpdf", args, { windowsHide: true });

        qpdf.on("error", error => reject("error"));

        qpdf.on("close",(code) => {

            if(code !== 0){
                return reject(new Error("qpdf is failed to add edit lock on pdf"));
            }

            resolve(outputPath);
        });
    });
};

module.exports = {
    editLockPdf
}