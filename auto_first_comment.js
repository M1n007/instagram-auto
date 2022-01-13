
const { v4: uuidv4 } = require('uuid');
const { IgApiClient } = require('instagram-private-api');
const { withFbns } = require('instagram_mqtt');
const Insta = require('./lib/index.js');
const InstaClient = new Insta();
const helpers = require('./lib/helpers/helper');
const readlineSync = require('readline-sync');
const fs = require('fs');
const chalk = require('chalk');
const moment = require('moment');

(async() => {

    let username;
    let password;

    if (fs.existsSync('./Cookies.json')) {
        try {
            const oldDataResult = await InstaClient.useExistingCookie();
            username = oldDataResult.username;
        } catch (e) {
            username = readlineSync.question('Masukan username : ');
            password = readlineSync.question('Masukan password : ');
            const result = await InstaClient.login(username, password);
            if (result.status && result.status == 'fail') {
                console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.red(`Gagal login : ${result.message}`));
            }
        }
    } else {
        username = readlineSync.question('Masukan username : ');
        password = readlineSync.question('Masukan password : ');
        const result = await InstaClient.login(username, password);
        if (result.status && result.status == 'fail') {
            console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.red(`Gagal login : ${result.message}`));
        }
    }
    console.log('')


    const target = readlineSync.question('Masukan username target post foto : ');


    const ig = withFbns(new IgApiClient());
    ig.state.generateDevice(username);

    // this will set the auth and the cookies for instagram
    await helpers.readState(ig);

    if (!fs.existsSync('./tmp/state.json')) {
        // this logs the client in
        await helpers.loginToInstagram(ig, username, password);
    }

    console.log('')
    console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.green('Waiting post...'));

    const commentFile = await fs.readFileSync('./comment.txt', 'utf-8');
    const commentArray = commentFile.toString().split("\n");

    // you received a notification
    ig.fbns.on('push', async (data) => {
        console.log('')
        const commentFinal = commentArray[Math.floor(Math.random() * commentArray.length)];
        if (data.message === `${target} just posted a photo.`) {

            const photos = await InstaClient.getImageByUser(target)

            const mediaData = {
                mediaUrl: photos.user.edge_owner_to_timeline_media.edges[0].node.edge_sidecar_to_children ? photos.user.edge_owner_to_timeline_media.edges[0].node.edge_sidecar_to_children.edges.map(data => {
                    return data.node.display_url;
                }) : [photos.user.edge_owner_to_timeline_media.edges[0].node.display_url],
                createdAt: photos.user.edge_owner_to_timeline_media.edges[0].node.taken_at_timestamp,
                shortCode: photos.user.edge_owner_to_timeline_media.edges[0].node.shortcode,
                mediaCaption: photos.user.edge_owner_to_timeline_media.edges[0].node.edge_media_to_caption.edges.length == 0 ? '' : photos.user.edge_owner_to_timeline_media.edges[0].node.edge_media_to_caption.edges[0].node.text
            }

            await InstaClient.likeMediaByShortCode(mediaData.shortCode);
            const resultCommentMedia= await InstaClient.commentToMediaByShortCode({shortCode: mediaData.shortCode, commentText: commentFinal});
            if (resultCommentMedia.status && resultCommentMedia.status == 'ok') {
                console.log(`[ ${moment().format("HH:mm:ss")} ] [ @${photos.user.username} | Shortcode : ${mediaData.shortCode} | Comment : ${commentFinal} ]  => `, chalk.green('Success Comment!'));
            } else {
                console.log(`[ ${moment().format("HH:mm:ss")} ] [ @${photos.user.username} | Shortcode : ${mediaData.shortCode} | Comment : ${commentFinal}  ]  => `, chalk.red('Failed To Comment!'));
            }
        }
    })

    // this sends the connect packet to the server and starts the connection
    // the promise will resolve once the client is fully connected (once /push/register/ is received)
    await ig.fbns.connect();
})();