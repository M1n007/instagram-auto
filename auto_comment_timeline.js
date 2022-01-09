const Insta = require('./lib/index.js');
const InstaClient = new Insta();
const fs = require('fs');
const readlineSync = require('readline-sync');
const moment = require('moment');
const chalk = require('chalk');
const delay = require('delay');

(async () => {
    try {

        

        console.log("")
        const likeLimit = readlineSync.question('Masukan limit per comment : ');
        const likeDelay = readlineSync.question('Masukan delay ( millisecond ) : ');
        if (fs.existsSync('./Cookies.json')) {
            try {
                await InstaClient.useExistingCookie();
            } catch (e) {
                const username = readlineSync.question('Masukan username : ');
                const password = readlineSync.question('Masukan password : ');
                const result = await InstaClient.login(username, password);
                if (result.status && result.status == 'fail') {
                    console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.red(`Gagal login : ${result.message}`));
                }
            }
        } else {
            const username = readlineSync.question('Masukan username : ');
            const password = readlineSync.question('Masukan password : ');
            const result = await InstaClient.login(username, password);
            if (result.status && result.status == 'fail') {
                console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.red(`Gagal login : ${result.message}`));
            }
        }
        console.log('')



        const resultHomePageSharedData = await InstaClient.getHomePageSharedData();

        if (resultHomePageSharedData.status && resultHomePageSharedData.status == 'ok') {
            let timelineResult = {};

            if (!fs.existsSync('./mediaCommented.txt')) {
                fs.writeFileSync('./mediaCommented.txt', '')
            }

            const allMediaFile = fs.readFileSync('./mediaCommented.txt', 'utf-8')
            let allMedia = allMediaFile.split('\n');
            let feedForLike = resultHomePageSharedData.feed_items;
            let i = 0;
            let maxId = resultHomePageSharedData.next_max_id;

            const commentFile = await fs.readFileSync('./comment.txt', 'utf-8');
            const commentArray = commentFile.toString().split("\n");
            do {
                i++;
                
                const commentFinal = commentArray[Math.floor(Math.random() * commentArray.length)];



                if (feedForLike[0].media_or_ad.has_liked) {

                    console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.blue('Delayed... to find new post.'));
                    do {
                        try {
                            timelineResult = await InstaClient.scrollTimeline(maxId);
                            if (timelineResult.status && timelineResult.status == 'ok') {
                                maxId = timelineResult.next_max_id
                                feedForLike = timelineResult.feed_items;
                                if (!feedForLike[0].media_or_ad.has_liked) {
                                    feedForLike = [];
                                    console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.cyan('New Post Found!!'));
                                    feedForLike.push(...timelineResult.feed_items);
                                }
                            }
                        } catch (e) {
                            console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.red('Limit scrolling, delayed 1 minute.'));
                            await delay(60000)
                        }


                    } while (feedForLike[0].media_or_ad.has_liked);
                } else {
                    try {
                        timelineResult = await InstaClient.scrollTimeline(maxId);
                        if (timelineResult.status && timelineResult.status == 'ok') {
                            maxId = timelineResult.next_max_id
                            feedForLike.push(...timelineResult.feed_items);
                        }

                        if (i >= 2) {
                            console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.blue('Delayed...'));
                            await delay(parseInt(likeDelay));
                        }

                        for (let index = 0; index < parseInt(likeLimit); index++) {
                            const element = feedForLike[index];
                            const shortCode = element.media_or_ad.code;
                            const checkWasLiked = allMedia.indexOf(shortCode);
                            if (checkWasLiked > -1) {
                                console.log(`[ ${moment().format("HH:mm:ss")} ] [ @${element.media_or_ad.user.username} | Shortcode : ${shortCode} | Comment : ${commentFinal}  ]  => `, chalk.yellow('Already Comment!'));
                            } else {
                                try {
                                    const resultLikeMedia = await InstaClient.commentToMediaByShortCode({shortCode, commentText: commentFinal});
                                    if (resultLikeMedia.status && resultLikeMedia.status == 'ok') {
                                        console.log(`[ ${moment().format("HH:mm:ss")} ] [ @${element.media_or_ad.user.username} | Shortcode : ${shortCode} | Comment : ${commentFinal} ]  => `, chalk.green('Success Comment!'));
                                        fs.appendFileSync('./mediaCommented.txt', `${shortCode}\n`);
                                        const indexMediaIdArray = feedForLike.map(function (e) { return e.media_or_ad.code; }).indexOf(shortCode);
                                        if (indexMediaIdArray > -1) {
                                            feedForLike.splice(indexMediaIdArray, 1);
                                        }
                                    } else {
                                        console.log(`[ ${moment().format("HH:mm:ss")} ] [ @${element.media_or_ad.user.username} | Shortcode : ${shortCode} | Comment : ${commentFinal}  ]  => `, chalk.red('Failed To Comment!'));
                                    }
                                } catch (e) {
                                    console.log(`[ ${moment().format("HH:mm:ss")} ] [ @${element.media_or_ad.user.username} | Shortcode : ${shortCode} | Comment : ${commentFinal}  ]  => `, chalk.red('Failed To Comment! (Harap tunggu beberapa menit sebelum mencoba lagi.)'));
                                }

                            }



                        }
                    } catch (e) {
                        console.log(`[ ${moment().format("HH:mm:ss")} ] `, chalk.red('Limit, delayed in 1 minutes'));
                        await delay(60000)
                    }

                }




            } while (timelineResult.next_max_id);
        }


    } catch (e) {
        console.log(e)
    }

})();