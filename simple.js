const SynOSS = require('./index.js')

async function main() {
    const oss = new SynOSS({
        region: '<Your region>',
        accessKeyId: '<Your AccessKeyId>',
        accessKeySecret: '<Your AccessKeySecret>',
        bucket: 'Your bucket name'
    })

    await oss.UploadDir('/test', './test')
    await oss.downloadDir('test', './test')
}

main()