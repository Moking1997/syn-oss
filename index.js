const OSS = require("ali-oss")
const fs = require("fs")
const path = require('path')
const status = require('node-status');
const log = console.log.bind(console)
const md5File = require('md5-file')

module.exports = class SynOSS {
    constructor(option) {
        this.client = new OSS(option)
        this.ossFileList = {}
        this.dirList = []
        this.uploadLen = 0
        this.uploadData = {}
        this.uploadProgress = null
        this.isStartUpload = false
        this.uploadError = 0
        this.downloadLen = 0
        this.downloadProgress = null
        this.isStartDownload = false
        this.downloadData = {}
        this.downloadError = 0

        this._init()
    }

    _init() {
        fs.mkdir('./data', e => {
            fs.exists('./data/download.json', function (exists) {
                if (!exists) {
                    fs.writeFileSync('./data/download.json', '{}', 'utf8')
                }
            });
            fs.exists('./data/update.json', function (exists) {
                if (!exists) {
                    fs.writeFileSync('./data/update.json', '{}', 'utf8')
                }
            });
        })

    }

    getProgress(type) {
        if (type == 'download') {
            this.downloadProgress.inc()
            if (this.downloadProgress.max == this.downloadProgress.val) {
                status.setPattern(`下载完成,共有 ${this.downloadError} 个文件下载失败`)
                fs.writeFile('./data/download.json', JSON.stringify(this.downloadData), 'utf8', (err) => {
                    if (err) {
                        log(err)
                    }
                    if (this.downloadError) {
                        log(`\n有 ${this.downloadError} 个文件下载失败,现在开始重新下载\n`)
                        this.downloadDir(this.ossPath, this.localPath)
                    } else {
                        this.isStartDownload = false
                    }

                })
            }

        } else {
            this.uploadProgress.inc()
            if (this.uploadProgress.max == this.uploadProgress.val) {
                status.setPattern(`上传完成,共有 ${this.uploadError} 个文件上传失败`)
                fs.writeFile('./data/update.json', JSON.stringify(this.uploadData), 'utf8', (err) => {
                    if (err) {
                        log(err)
                    }
                    if (this.uploadError) {
                        log(`\n有 ${this.uploadError} 个文件上传失败,现在开始重新上传\n`)
                        this.UploadDir(this.ossPath, this.localPath)
                    }
                })

            }
        }
    }

    /**
     * 文件上传方法
     * @param ossPath 上传后的文件路径
     * @param localPath 本地文件路径
     */
    async Upload(ossPath, localPath) {
        try {
            let result = await this.client.multipartUpload(ossPath, localPath)
        } catch (e) {
            log("上传错误:", e)
            log("错误文件:", localPath)
            delete this.uploadData[localPath]
            this.uploadError++
        } finally {
            if (this.isStartUpload) {
                this.getProgress()
            } else {
                log(localPath, '上传完成')
            }
        }
    }

    /**
     * 文件夹上传方法
     * @param ossDir 上传后的文件夹路径
     * @param localDir 本地文件夹路径
     */
    async UploadDir(ossDir, localDir) {
        log('开始上传')
        this.ossPath = ossDir
        this.localPath = localDir
        this.uploadError = 0
        this.uploadLen = 0
        this.isStartUpload = false
        this.uploadData = {}
        fs.readdir(localDir, (err, files) => {
            if (err) {
                console.warn(err)
            } else {
                this.uploadLen += files.length
                files.forEach((filename) => {
                    let fileDir = path.join(localDir, filename)
                    fs.stat(fileDir, async (err, stats) => {
                        if (err) {
                            console.warn('获取文件stats失败')
                        } else {
                            let isFile = stats.isFile()
                            let isDir = stats.isDirectory()
                            if (isFile) {
                                let data = {
                                    md5: md5File.sync(fileDir),
                                    localPath: fileDir,
                                    ossPath: ossDir + fileDir.substr(fileDir.indexOf('/')),
                                }
                                this.uploadData[fileDir] = data
                            }
                            if (isDir) {
                                this.uploadLen--
                                await this.UploadDir(ossDir, fileDir)
                            }
                            let len = Object.keys(this.uploadData).length;
                            if (len == this.uploadLen && !this.isStartUpload) {
                                this.isStartUpload = true
                                this.startUpload()
                            }
                        }
                    })
                })
            }
        })
    }

    async startUpload() {
        fs.readFile('./data/update.json', 'utf8', (err, result) => {
            if (err) {
                log(err)
            }
            let dirs = this.uploadData
            let data = JSON.parse(result)
            let uploadData = []
            for (let i in dirs) {
                const d = data[i];
                const e = dirs[i];
                if (!d || d.md5 != e.md5) {
                    uploadData.push(e)
                }
            }

            this.uploadProgress = status.addItem('upload', {
                label: '上传进度',
                max: uploadData.length,
                count: 0,
                precision: 0,
                custom: function () {
                    return `${this.count} / ${this.max}`;
                }
            });
            status.start({
                pattern: '{uptime.green} {spinner.cyan}  |  Total: {upload.percentage}  |  上传进度: {upload.blue.bar} {upload.custom.magenta}'
            });

            this.uploadLen = uploadData.length
            if (uploadData.length == 0) {
                status.removeAll()
                status.setPattern('上传文件无改动')
            }
            for (let i = 0; i < uploadData.length; i++) {
                const e = uploadData[i];
                this.Upload(e.ossPath, e.localPath)
            }
        })
    }

    /**
     * 文件下载方法
     * @param ossPath 下载后的文件路径
     * @param localPath 本地文件路径
     */
    async get(ossPath, localPath) {
        try {
            let result = await this.client.get(ossPath, localPath);
        } catch (e) {
            log('下载失败:', ossPath);
            log('报错信息:', e);
            delete this.downloadData[ossPath]
            this.downloadError++
        } finally {
            if (this.isStartDownload) {
                this.getProgress('download')
            } else {
                log(ossPath, '下载完成')
            }
        }
    }

    /**
     * 文件夹下载
     * @param ossPath 下载后的文件路径
     * @param localPath 本地文件夹路径
     */
    async downloadDir(ossPath, localPath) {
        log('开始下载')
        this.downloadData = {}
        this.downloadError = 0
        this.ossPath = ossPath
        this.localPath = localPath
        this.isStartDownload = true
        ossPath = ossPath + '/'
        localPath = localPath + '/'
        log('同步目录结构中...')
        await this.getOssFileList(ossPath)
        await this.readOssDir(ossPath)
        let dirs = this.downloadData

        for (let i = 0; i < this.dirList.length; i++) {
            let dir = this.dirList[i];
            dir = dir.replace(ossPath, localPath)
            this.mkdirs(dir, () => { })
        }

        fs.readFile('./data/download.json', 'utf8', (err, result) => {
            if (err) {
                log(err)
            }
            let data = JSON.parse(result)
            let downloadData = []
            for (let i in dirs) {
                const d = data[i];
                const e = dirs[i];
                if (!d || d.etag != e.etag) {
                    downloadData.push(e)
                }
            }

            this.downloadProgress = status.addItem('download', {
                label: '下载进度',
                max: downloadData.length,
                count: 0,
                precision: 0,
                custom: function () {
                    return `${this.count} / ${this.max}`;
                }
            });
            status.start({
                pattern: '{uptime.green} {spinner.cyan}  |  Total: {download.percentage}  |  下载进度: {download.green.bar} {download.custom.magenta}'
            });
            this.downloadLen = downloadData.length
            if (downloadData.length == 0) {
                status.setPattern('已经全部下载完成')
            }
            for (let i = 0; i < downloadData.length; i++) {
                const e = downloadData[i];
                let ossName = e.name
                let localName = ossName.replace(ossPath, localPath)
                this.get(ossName, localName)
            }

        })
    }

    /**
   * 读取 oss 文件列表
   * @param ossPath oss的文件夹路径
   */
    async readOssFile(ossPath, marker) {
        try {
            const result = await this.client.list({
                prefix: ossPath,
                marker: marker || null
            });

            if (result.nextMarker) {
                await this.readOssFile(ossPath, result.nextMarker)
            }
            result.objects.forEach(obj => {
                log('Object: %s', obj.name);
            });
        } catch (e) {
            log(e);
        }
    }

    /**
   * 读取 oss 文件夹目录列表
   * @param ossPath oss的文件夹路径
   */
    async readOssDir(ossPath, marker) {
        try {
            const result = await this.client.list({
                prefix: ossPath,
                marker: marker || null,
                delimiter: '/'
            });

            if (result.prefixes) {
                for (let i = 0; i < result.prefixes.length; i++) {
                    await this.readOssDir(result.prefixes[i])
                }
                result.prefixes.forEach(subDir => {
                    this.dirList.push(subDir)
                });
            }

            if (result.nextMarker) {
                await this.readOssDir(ossPath, result.nextMarker)
            }
        } catch (e) {
            log(e);
        }
    }

    /**
    * 获取取 oss 文件列表信息
    * @param ossPath oss的文件路径
    */
    async getOssFileList(ossPath, marker) {
        const result = await this.client.list({
            prefix: ossPath,
            marker: marker || null
        });
        result.objects.forEach(obj => {
            let name = obj.name
            if (name.substr(-1) != '/') {
                this.downloadData[name] = obj
            }
        });
        if (result.nextMarker) {
            await this.getOssFileList(ossPath, result.nextMarker)
        }
    }

    mkdirs(dirname, callback) {
        fs.exists(dirname, (exists) => {
            if (exists) {
                callback();
            } else {
                this.mkdirs(path.dirname(dirname), () => {
                    fs.mkdir(dirname, callback);
                });
            }
        });
    }
}


