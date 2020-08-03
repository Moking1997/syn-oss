## 下载仓库

`git clone https://github.com/Moking1997/syn-oss.git`

## 示例

```js
const SynOSS = require('syn-oss')

async function main() {
    const oss = new SynOSS({
        region: '<Your region>',
        accessKeyId: '<Your AccessKeyId>',
        accessKeySecret: '<Your AccessKeySecret>',
        bucket: 'Your bucket name'
    })
    // getOssFileList(dir, marker)
    await oss.getOssFileList(ossPath)
    // readOssDir(ossPath, marker)
    await oss.readOssDir(ossPath, )
    // Upload(ossPath, localPath)
    await oss.Upload('/text.js', './test.js')
    // get(ossPath, localPath) 
    await oss.downloadDir('text.js', './test.js')
    // UploadDir(ossDir, localDir) 
    await oss.UploadDir('/test', './test')
    // downloadDir(ossDir, localDir) 
    await oss.downloadDir('test', './test')
}

main()
```
