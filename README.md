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
    // UploadDir(ossDir, localDir) 
    await oss.UploadDir('/test', './test')
    // downloadDir(ossDir, localDir) 
    await oss.downloadDir('test', './test')
}

main()
```
