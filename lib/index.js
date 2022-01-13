// https://www.npmjs.com/package/node-insta-web-api

const crypto = require('crypto');
const fs = require('fs');

const request = require('./request');
const helpers = require('./helpers/helper');
const useragentFromSeed = require('useragent-from-seed');
const isUrl = require('is-url');

//instagram private api client
const {IgApiClient}= require('instagram-private-api');
const ig = new IgApiClient();
const { v4: uuidv4} = require('uuid');

class Instagram{
    constructor(username,password){
        this.credentials = {
            username,
            password
        }
        this.baseUrl = 'https://www.instagram.com/';
        this.baseUrlZ4 = 'https://z-p4.www.instagram.com/';
        this.baseUrlAPI = 'https://i.instagram.com/';
        this.ig_did = '';
        this.csrf = '';
        this.rur = '';
        this.mid = '';
        this.username = '';
        this.phoneNumber = '';
        this.firstName = '';
        this.language = '';
        this.sessionid = '';
        this.ds_user_id = '';
        this.deviceId = uuidv4();

        this.headers = {
            'authority': 'www.instagram.com',
            'sec-ch-ua': '" Not A;Brand";v="99", "Chromium";v="96", "Google Chrome";v="96"',
            'x-ig-app-id': '936619743392459',
            'x-ig-www-claim': '0',
            'sec-ch-ua-mobile': '?0',
            'x-instagram-ajax': '05272981ffad',
            'content-type': 'application/x-www-form-urlencoded',
            'accept': '*/*',
            'x-requested-with': 'XMLHttpRequest',
            'x-asbd-id': '198387',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
            'sec-ch-ua-platform': '"macOS"',
            'origin': 'https://www.instagram.com',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'navigate',
            'sec-fetch-dest': 'empty'
        }

        this.requestNodeFetch = request.nodeFetchInstagram;
        this.request = request.requestInstagram;

    }

    async useCustomerHeaders(headers){
        try{
            this.headers = headers;
            return this.headers;
        }catch(e){
            return e;
        }
    }

    async getCookie(){
        try{
            this.headers["user-agent"] = useragentFromSeed();
            const result = await this.requestNodeFetch.getCookie('https://www.instagram.com/accounts/web_create_ajax/attempt/', this.headers);
            this.ig_did = result.cookie.find((x)=> { return x.includes('ig_did')}) ? result.cookie.find((x)=> { return x.includes('ig_did')}).split(';')[0] : '';
            this.csrf = result.cookie.find((x)=> { return x.includes('csrftoken')}) ? result.cookie.find((x)=> { return x.includes('csrftoken')}).split(';')[0] : '';
            this.rur = result.cookie.find((x)=> { return x.includes('rur')}) ? result.cookie.find((x)=> { return x.includes('rur')}).split(';')[0] : '';
            this.mid = result.cookie.find((x)=> { return x.includes('mid')}) ? result.cookie.find((x)=> { return x.includes('mid')}).split(';')[0] : '';
            this.headers["x-csrftoken"] = this.csrf.split('=')[1];
            this.headers['x-ig-www-claim'] = result.claim[0];
            this.headers.cookie = `ig_cb=1; ${this.ig_did ? this.ig_did : `ig_did=${this.deviceId}`}; ${this.csrf}; ${this.rur}; ${this.mid}`;
            return this.headers;
        }catch(e){
            return e;
        }
    }

    async getHeaders(){
        try{
            return this.headers;
        }catch(e){
            return e;
        }
    }

    async useExistingCookie(){
        try{
            if (fs.existsSync('./Cookies.json')) {
                const existingCookies = await fs.readFileSync('./Cookies.json', 'utf-8');
                const existingCookiesJson = JSON.parse(existingCookies);
                this.headers = existingCookiesJson;
                const oldData = await this.getProfileData();
                console.log(`you using existing cookie for user ${oldData.username}.`)
                return oldData;
            }else{
                console.log(`You don't have cookies yet`);
            }
        }catch(e){
            throw new Error('cookie format is wrong / expired, please try logging in again using function login().')
        }
    }

    async useInstagramPrivateAPICookie(cookieFileIGApi){
        try{
            const allState = await fs.readFileSync(cookieFileIGApi, 'utf-8');
            const cookie = JSON.parse(JSON.parse(allState).client.cookies).cookies;
            this.headers["x-csrftoken"] = cookie.find((x) => x.key == 'csrftoken').value;
            this.rur = cookie.find((x) => x.key == 'rur').value;
            this.mid = cookie.find((x) => x.key == 'mid').value;
            this.sessionid = cookie.find((x) => x.key == 'sessionid').value;
            this.ds_user_id = cookie.find((x) => x.key == 'ds_user_id').value;
            const cookieTemplate = `ig_cb=1; csrftoken=${this.headers["x-csrftoken"]}; rur=${this.rur}; mid=${this.mid}; ds_user_id=${this.ds_user_id}; sessionid=${this.sessionid}`;
            this.headers.cookie = cookieTemplate;
            const oldData = await this.getProfileData();
            console.log(`you using existing cookie for user ${oldData.username}.`)
            return oldData;
        }catch(e){
            throw new Error(e)
        }
    }

    async login(username, password){
        try{
            await this.getCookie()
            username = username || this.credentials.username
            password = password || this.credentials.password
            this.headers.referer = this.baseUrl;
            const body = `username=${username}&enc_password=${helpers.createEncPassword(password)}&queryParams=%7B%7D&optIntoOneTap=false`;

            const result = await this.requestNodeFetch.post(`${this.baseUrl}accounts/login/ajax/`,body, this.headers);
            if (!result.headers.raw()['set-cookie']) {
                throw new Error('No cookie')
            }

            const cookies = result.headers.raw()['set-cookie'];
            if (!cookies.find((x)=> { return x.includes('sessionid')})) {
                return await result.json();
            }

            const resultJson = await result.json();
            this.ds_user_id = resultJson.userId;
            this.sessionid = cookies.find((x)=> { return x.includes('sessionid')}).split(';')[0];

            this.csrf = cookies.find((x)=> { return x.includes('csrftoken')}).split(';')[0];
            this.headers["x-csrftoken"] = this.csrf.split('=')[1];
            this.headers.cookie = `ig_cb=1; ${this.ig_did}; ${this.csrf}; ${this.rur}; ${this.mid}; ds_user_id=${this.ds_user_id}; ${this.sessionid}`;

            this.credentials = {
                username,
                password,
                cookies
            }

            // this._sharedData = await this._getSharedData();
            fs.writeFileSync('Cookies.json', JSON.stringify(this.headers))
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async changeProfileImage(image){
        try{
            const payload =  {
                profile_pic: isUrl(image) ? await this.requestNodeFetch.getText(image) : fs.createReadStream(image)
            }
            const result = await this.request.post(`${this.baseUrl}accounts/web_change_profile_picture/`, payload, this.headers);
            return result;
        }catch(e){
            throw new Error(e)
        }
    }

    async getProfileData(){
        try {
            const result = await this._getSharedData(`${this.baseUrl}accounts/edit/`);
            return result.entry_data.SettingsPages[0].form_data;
        }catch(e){
            throw new Error(e)
        }
    }

    async getHomePageSharedData(){
        try {
            const result = await this._getAdditionalData(`${this.baseUrl}`);
            return result;
        }catch(e){
            throw new Error(e)
        }
    }

    async getIdContentFromShortCode(codePage){
        try {
            const result = await this.requestNodeFetch.get(`${this.baseUrl}graphql/query/?query_hash=6ff3f5c474a240353993056428fb851e&variables=%7B%22shortcode%22%3A%22${codePage}%22%2C%22include_reel%22%3Atrue%2C%22include_logged_out%22%3Afalse%7D`);
            const jsonResult = await result.json();
            return jsonResult.data.shortcode_media.owner.id;
        }catch(e){
            throw new Error(e)
        }
    }

    async getContentDataById(idContent){
        try {
            const result = await this.requestNodeFetch.get(`${this.baseUrl}graphql/query/?query_hash=15bf78a4ad24e33cbd838fdb31353ac1&variables=%7B%22id%22%3A%22${idContent}%22%2C%22first%22%3A12%7D`);
            const jsonResult = await result.json();
            return jsonResult.data.user.edge_owner_to_timeline_media.edges;
        }catch(e){
            throw new Error(e)
        }
    }

    async getUserPostById(userId) {
        try {
            const result = await this.requestNodeFetch.get(`${this.baseUrl}graphql/query/?query_hash=eddbde960fed6bde675388aac39a3657&variables=${encodeURI(`{"id":"${userId}","first":1}`)}`, this.headers)
            return (await result.json()).data.user.edge_owner_to_timeline_media.edges
        } catch (e) {
            throw new Error(e)
        }
    }

    async getMediaFeedByHashtag(tag) {
        try {
            const result = await this.requestNodeFetch.get(`${this.baseUrl}explore/tags/${tag}/?__a=1`)
            return (await result.json()).graphql.hashtag
        } catch (e) {
            throw new Error(e)
        }
    }

    async getVideoByShortCode(codePage){
        try {
            const idContent = await this.getIdContentFromShortCode(codePage);
            const dataContent = await this.getContentDataById(idContent);
            const videoUrl = dataContent.find((x) => {
                return x.node.shortcode == codePage
            });
            const getVideo = await this.requestNodeFetch.get(videoUrl.node.video_url);
            const videoBuffer = await getVideo.buffer();
            const buf = Buffer.from(videoBuffer);
            const base64Video = buf.toString('base64');
            const data = {
                base64: base64Video,
                buffer: videoBuffer
            }
            return data;
        }catch(e){
            throw new Error(e)
        }
    }

    async updateProfile({
        biography = '',
        email = '',
        username = '',
        phoneNumber = ''
      }){
        try{
            const oldData = await this.getProfileData();
            this.headers.referer = `${this.baseUrl}accounts/edit/`;
            const payload = `first_name=${oldData.first_name}&email=${email ? email : oldData.email}&username=${username || oldData.username}&phone_number=${phoneNumber === 'delete' ? '' : phoneNumber ?  phoneNumber : oldData.phone_number}&biography=${biography || oldData.biography}&external_url=&chaining_enabled=on`;
            const result = await this.requestNodeFetch.post(`${this.baseUrl}accounts/edit/`, payload, this.headers);
            return await result.json();
        }catch(e){
            throw new Error(e)
        }
    }

    async sendConfirmationEmail(){
        try{
            this.headers.referer = `${this.baseUrl}`;
            const result = await this.requestNodeFetch.post(`${this.baseUrlZ4}accounts/send_confirm_email/`, '', this.headers);
            return await result.json();
        }catch(e){
            throw new Error(e)
        }
    }



    async registerLastAttemp(phoneNumber, username, password, firstName){
        try {
            this.username = username;
            this.firstName = firstName;
            this.phoneNumber = phoneNumber;
            this.password = password;
            const dataString = `enc_password=${helpers.createEncPassword(password)}&phone_number=${phoneNumber}&username=${username}&first_name=${firstName}&month=4&day=6&year=2000&client_id=${this.mid.split('=')[1]}&seamless_login_enabled=1`;
            this.headers.referer = `${this.baseUrl}accounts/emailsignup/`;
            this.headers["x-csrftoken"] = this.csrf.split('=')[1];
            const register = await this.requestNodeFetch.postResJson(`${this.baseUrl}accounts/web_create_ajax/attempt/`, dataString, this.headers);
            return register;
        }catch(e){
            throw new Error(e)
        }

    }

    async registerSendOtp(phoneNumber){
        try {
            const dataString = `client_id=${this.mid.split('=')[1]}&phone_number=${phoneNumber}&phone_id=&big_blue_token=`;
            this.headers.referer = `${this.baseUrl}accounts/emailsignup/`;
            this.headers["x-csrftoken"] = this.csrf.split('=')[1];
            const register = await this.requestNodeFetch.postResJson(`${this.baseUrl}accounts/send_signup_sms_code_ajax/`, dataString, this.headers);
            return register;
        }catch(e){
            throw new Error(e)
        }

    }

    async registerLastProcess(otpCode){
        try {
            const dataString = `enc_password=${helpers.createEncPassword(this.password)}&phone_number=${this.phoneNumber}&username=${this.username}&first_name=${this.firstName}&month=4&day=6&year=2000&sms_code=${otpCode}&client_id=${this.mid.split('=')[1]}&seamless_login_enabled=1&tos_version=row`;
            this.headers.referer = `${this.baseUrl}accounts/emailsignup/`;
            this.headers["x-csrftoken"] = this.csrf.split('=')[1];
            const register = await this.requestNodeFetch.postResJson(`${this.baseUrl}accounts/web_create_ajax/`, dataString, this.headers);
            return register;
        }catch(e){
            throw new Error(e)
        }

    }

    async _getSharedData(url = this.baseUrl) {
        try{
            const getText = await this.requestNodeFetch.getText(url, this.headers);
            const _sharedData = helpers.getString('<script type="text/javascript">window._sharedData =', '};</script>', getText);
            const resultJsonStringData = `${_sharedData[1]}}`;
            const resultJson = JSON.parse(resultJsonStringData);
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async _getAdditionalData(url = this.baseUrl) {
        try{
            const getText = await this.requestNodeFetch.getText(url, this.headers);
            const _additionalData = helpers.getString('window.__additionalDataLoaded(', ');</script>', getText);
            const resultJsonStringData = _additionalData.toString().includes('feed_v2')? _additionalData[1].replace("('feed_v2',", '') :
            _additionalData[1].split(`('${url.split('com')[1]}',`)[1];
            const resultJson = JSON.parse(resultJsonStringData.substring(0, resultJsonStringData.length - 1));
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async _getMediaId(url = this.baseUrl) {
        try{
            const getText = await this.requestNodeFetch.getText(url, this.headers);
            let _getMediaId = getText.split('<meta property="al:ios:url" content="instagram://media?id=').pop().split('" />')[0];
            if (_getMediaId.toString().includes('<meta property="al:android:app_name" content="Instagram"/>')) {
                _getMediaId = _getMediaId.split('"/>')[0];
            }
            return _getMediaId;
        }catch(e){
            throw new Error(e)
        }
    }

    async _getGis(path) {
        const { rhx_gis } = this._sharedData || (await this._getSharedData(path))
    
        return crypto
          .createHash('md5')
          .update(`${rhx_gis}:${path}`)
          .digest('hex')
      }

    async getImageByUser(username){
        try {
            const result = await this._getSharedData(`${this.baseUrl}${username}/`);
            return result.entry_data.ProfilePage[0].graphql;
        }catch(e){
            throw new Error(e)
        }

    }

    async getLoginActivity(){
        try {
            const result = await this._getSharedData(`${this.baseUrl}session/login_activity/`);
            return result.entry_data.SettingsPages[0].data;
        }catch(e){
            throw new Error(e)
        }

    }

    async getRecentNotification(){
        try {
            const result = await this.requestNodeFetch.get(`${this.baseUrl}accounts/activity/?__a=1&include_reel=true`, this.headers);
            const resultJson = await result.json();
            return resultJson.graphql.user.activity_feed.edge_web_activity_feed.edges;
        }catch(e){
            throw new Error(e)
        }

    }

    async getDirectMessage(limit = 10, thread_message_limit = 10){
        try {
            const result = await this.requestNodeFetch.get(`${this.baseUrl}direct_v2/web/inbox/?persistentBadging=true&folder=&limit=${limit}&thread_message_limit=${thread_message_limit}`, this.headers);
            const resultJson = await result.json();
            return resultJson.inbox.threads;
        }catch(e){
            throw new Error(e)
        }

    }

    async _getSchemaProfileData(username) {
        try{
            const getText = await this.requestNodeFetch.getText(`${this.baseUrl}${username}/`, this.headers);
            const _schemaData = getText.split('<script type="application/ld+json">').pop().split('</script>')[0];
            const resultJsonStringData = _schemaData.trim();
            const resultJson = JSON.parse(resultJsonStringData);
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }


    async getProfileByUsername(username){
        try {
            const result = await this._getSharedData(`${this.baseUrl}${username}/`, this.headers);
            const schemaUserData = result.entry_data.ProfilePage[0].graphql.user;
            const data = {
                userId: schemaUserData.id,
                profilePicUrl: schemaUserData.profile_pic_url,
                name: schemaUserData.full_name,
                username: schemaUserData.username,
                biography: schemaUserData.biography,
                website: schemaUserData.external_url,
                follow: schemaUserData.edge_follow.count,
                followers: schemaUserData.edge_followed_by.count,
                totalPost: schemaUserData.edge_owner_to_timeline_media.count,
                followedByViewer: schemaUserData.followed_by_viewer,
                follows_viewer: schemaUserData.follows_viewer
            };

            return data;
        }catch(e){
            throw new Error(e)
        }

    }

    async followByUsername(username){
        try {
            const {userId} = await this.getProfileByUsername(username);
            this.headers.referer = `${this.baseUrl}${username}/`;
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/friendships/${userId}/follow/`, null, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }

    }

    async setGender(genderType = '1'){
        try {
            // 1 = male, 2 = female
            const dataString = `gender=${genderType}&custom_gender=`
            this.headers.referer = `${this.baseUrl}accounts/edit/`;
            const result = await this.requestNodeFetch.post(`${this.baseUrl}accounts/set_gender/`, dataString, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }

    }

    async unfollowByUsername(username){
        try {
            const {userId} = await this.getProfileByUsername(username);
            this.headers.referer = `${this.baseUrl}${username}/`;
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/friendships/${userId}/unfollow/`, null, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }

    }

    async getStoriesByUsername(username){
        try {
            const {userId} = await this.getProfileByUsername(username);
            this.headers.referer = `${this.baseUrl}${username}/`;
            const payloadVariables = {"reel_ids":[userId],"tag_names":[],"location_ids":[],"highlight_reel_ids":[],"precomposed_overlay":false,"show_story_viewer_list":true,"story_viewer_fetch_count":50,"story_viewer_cursor":"","stories_video_dash_manifest":false}
            const result = await this.requestNodeFetch.get(`${this.baseUrl}graphql/query/?query_hash=90709b530ea0969f002c86a89b4f2b8d&variables=${encodeURI(JSON.stringify(payloadVariables))}`, this.headers);
            const resultJson = await result.json();
            const data = resultJson.data.reels_media[0];
            const newResult = {
                user: data.user,
                items: data.items.map(data => {
                    let story = {
                        storyId: data.id,
                        postAt: data.taken_at_timestamp,
                        expiredAt: data.expiring_at_timestamp,
                        storyUrl: data.story_cta_url,
                        storiesImagePreview: data.display_url,
                        isVideo: data.is_video,
                        video: null
                    }
                    if (data.is_video) {
                        story.video = {
                            duration: data.video_duration,
                            source: data.video_resources
                        }
                        return story
                    } else {
                        return story
                    }
                })
            }
            return newResult;
        }catch(e){
            throw new Error(e)
        }

    }

    async likeMediaById(mediaId, shortCode) {
        try {
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/likes/${mediaId}/like/`, null, this.headers)
            return await result.json()
        } catch (e) {
            throw new Error(e)
        }
    }

    async likeCommentById(shortCode, commentId) {
        try {
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const result = await this.request.postNoForm(`${this.baseUrl}web/comments/like/${commentId}/`, this.headers)
            return await result.json()
        } catch (e) {
            throw new Error(e)
        }
    }


    async likeMediaByShortCode(shortCode){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const mediaId = await this._getMediaId(`${this.baseUrl}p/${shortCode}/`);
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/likes/${mediaId}/like/`, null, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async unlikeMediaByShortCode(shortCode){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const mediaId = await this._getMediaId(`${this.baseUrl}p/${shortCode}/`);
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/likes/${mediaId}/unlike/`, null, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async deleteMediaByShortCode(shortCode){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const mediaId = await this._getMediaId(`${this.baseUrl}p/${shortCode}/`);
            const result = await this.requestNodeFetch.post(`${this.baseUrl}create/${mediaId}/delete/`, null, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async saveImageByShortCode(shortCode){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const mediaId = await this._getMediaId(`${this.baseUrl}p/${shortCode}/`);
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/save/${mediaId}/save/`, null, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async unsaveImageByShortCode(shortCode){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const mediaId = await this._getMediaId(`${this.baseUrl}p/${shortCode}/`);
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/save/${mediaId}/unsave/`, null, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async getDetailMedia(url){
        try{
            const result = await this._getSharedData(url);
            return result
        }catch(e){
            throw new Error(e)
        }
    }

    async commentToMediaByMediaId({ mediaId = '', commentText = '' }) {
        try {
            this.headers.referer = `${this.baseUrl}p/${mediaId}/`
            const payload = `comment_text=${commentText}&replied_to_comment_id=`
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/comments/${mediaId}/add/`, payload, this.headers)
            return await result.json()
        } catch (e) {
            throw new Error(e)
        }
    }

    async commentToMediaByShortCode({shortCode = '', commentText = ''}){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const mediaId = await this._getMediaId(`${this.baseUrl}p/${shortCode}/`);
            const payload = `comment_text=${commentText}&replied_to_comment_id=`
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/comments/${mediaId}/add/`, payload, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async replyCommentByShortCode({shortCode = '', commentText = '', commentId= ''}){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const mediaId = await this._getMediaId(`${this.baseUrl}p/${shortCode}/`);
            const payload = `comment_text=${commentText}&replied_to_comment_id=${commentId}`
            const result = await this.requestNodeFetch.post(`${this.baseUrl}web/comments/${mediaId}/add/`, payload, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }
    

    async getEmbedMediaByShortCode(shortCode){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const result = await this.requestNodeFetch.get(`https://api.instagram.com/oembed/?url=https://www.instagram.com/p/${shortCode}/&hidecaption=0&maxwidth=540`, this.headers);
            const resultJson = await result.json();
            return resultJson;
        }catch(e){
            throw new Error(e)
        }
    }

    async findPeopleByUsername(username){
        try{
            this.headers.referer = `${this.baseUrl}explore/search/`;
            const result = await this.requestNodeFetch.get(`${this.baseUrl}web/search/topsearch/?context=blended&query=%40${username}&rank_token=0.7932692446666738&include_reel=true
            `, this.headers);
            const resultJson = await result.json();
            return resultJson.users;
        }catch(e){
            throw new Error(e)
        }
    }

    async findPeopleByUserId(userId) {
        try {
            this.headers.referer = `${this.baseUrl}explore/search/`
            const result = await this.requestNodeFetch.get(`https://i.instagram.com/api/v1/users/${userId}/info/`, this.headers)
            return (await result.json()).user
        } catch (e) {
            throw new Error(e)
        }
    }

    async uploadPhotoByPath(photo){
        try{
            const uploadId = Date.now();

            const file = await fs.readFileSync(photo);

            const uploadParams = {
                media_type: 1,
                upload_id: uploadId.toString(),
                upload_media_height: 1080,
                upload_media_width: 1080,
                xsharing_user_ids: JSON.stringify([]),
                image_compression: JSON.stringify({
                    lib_name: 'moz',
                    lib_version: '3.1.m',
                    quality: '80'
                })
            }
          
            const nameEntity = `${uploadId}_0_${Math.random(1000000000, 9999999999)}`

            const headersPhoto = {
                'x-entity-type': 'image/jpeg',
                offset: 0,
                'x-entity-name': nameEntity,
                'x-instagram-rupload-params': JSON.stringify(uploadParams),
                'x-entity-length': file.byteLength,
                'Content-Length': file.byteLength,
                'Content-Type': 'application/octet-stream',
                'x-ig-app-id': `1217981644879628`,
                'Accept-Encoding': 'gzip',
                'X-Pigeon-Rawclienttime': (Date.now() / 1000).toFixed(3),
                'X-IG-Connection-Speed': `${Math.random(1000, 3700)}kbps`,
                'X-IG-Bandwidth-Speed-KBPS': '-1.000',
                'X-IG-Bandwidth-TotalBytes-B': '0',
                'X-IG-Bandwidth-TotalTime-MS': '0',
                ...this.headers
            }

            const result = await this.request.postDefault(`${this.baseUrlZ4}rupload_igphoto/${nameEntity}`, file, headersPhoto);
            return JSON.parse(result);
        }catch(e){
            throw new Error('failed to uploading images', e)
        }
    }

    async addPost(photo, caption = ''){
        try{
            const dateObj = new Date()
            const now = dateObj
              .toISOString()
              .replace(/T/, ' ')
              .replace(/\..+/, ' ')
            const offset = dateObj.getTimezoneOffset()
        
            const responseUpload = await this.uploadPhotoByPath(photo);

            const payloadForm = {
                upload_id: responseUpload.upload_id,
                caption,
                timezone_offset: offset,
                date_time_original: now,
                date_time_digitalized: now,
                source_type: '4',
                edits: {
                    crop_original_size: [1080, 1080],
                    crop_center: [0.0, -0.0],
                    crop_zoom: 1.0
                }
            }

            const result = await this.request.postForm(`${this.baseUrl}create/configure/`, payloadForm, this.headers);
            return result;
        }catch(e){
            throw new Error(e)
        }
    }

    async addStory(photo){
        try{
            const dateObj = new Date()
            const now = dateObj
              .toISOString()
              .replace(/T/, ' ')
              .replace(/\..+/, ' ')
            const offset = dateObj.getTimezoneOffset()
        
            const responseUpload = await this.uploadPhotoByPath(photo);
            
            const payloadForm = {
                upload_id: responseUpload.upload_id,
                caption: 'test a',
                timezone_offset: offset,
                date_time_original: now,
                date_time_digitalized: now,
                source_type: '4',
                edits: {
                    crop_original_size: [1080, 1080],
                    crop_center: [0.0, -0.0],
                    crop_zoom: 1.0
                }
            }

            const result = await this.request.postForm(`${this.baseUrl}create/configure_to_story/`, payloadForm, this.headers);
            return result;
        }catch(e){
            throw new Error(e)
        }
    }

    async getFollowingByDataUser(dataUser, first = 12, after = ''){
        try{
            const {userId, username} = dataUser;
            const hash = 'd04b0a864b4b54837c0d870b0e77e076';
            const variable = {
                "id":userId,
                "include_reel":true,
                "fetch_mutual":false,
                "first":first,
                "after": after
            }
            this.headers.referer = `${this.baseUrl}${username}/following/`;
            const result = await this.requestNodeFetch.get(`${this.baseUrlZ4}graphql/query/?query_hash=${hash}&variables=${encodeURI(JSON.stringify(variable))}`, this.headers);
            const resultJson = await result.json();
            return resultJson.data.user.edge_follow;
        }catch(e){
            throw new Error(e)
        }
    }

    async getCommentAdditionalData(shortCode){
        try{
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const resultData = await this._getAdditionalData(`${this.baseUrl}p/${shortCode}/`, this.headers);
            return resultData.graphql.shortcode_media.edge_media_to_parent_comment
        }catch(e){
            throw new Error(e)
        }
    }

    async getFirstComment(shortCode, first = 12, after = ''){
        try{
            const hash = '7d4d42b121a214d23bd43206e5142c8c';
            const variable = {
                "shortcode":shortCode,
                "child_comment_count":3,
                "fetch_comment_count":40,
                "parent_comment_count":24,
                "has_threaded_comments":true
            }
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const result = await this.requestNodeFetch.get(`${this.baseUrl}graphql/query/?query_hash=${hash}&variables=${encodeURI(JSON.stringify(variable))}`, this.headers);
            const resultJson = await result.json();
            return resultJson.data.shortcode_media ? resultJson.data.shortcode_media.edge_media_to_parent_comment : false;
        }catch(e){
            throw new Error(e)
        }
    }

    async getAllComment(shortCode, first = 12, after = ''){
        try{
            const hash = 'bc3296d1ce80a24b1b6e40b1e72903f5';
            const variable = {
                "shortcode": shortCode,
                first,
                after
            }
            this.headers.referer = `${this.baseUrl}p/${shortCode}/`;
            const result = await this.requestNodeFetch.get(`${this.baseUrl}graphql/query/?query_hash=${hash}&variables=${encodeURI(JSON.stringify(variable))}`, this.headers);
            const resultJson = await result.json();
            return resultJson.data.shortcode_media ? resultJson.data.shortcode_media.edge_media_to_parent_comment : false;
        }catch(e){
            throw new Error(e)
        }
    }

    async scrollTimeline(max_id){
        try {
            const payloadForm = `device_id=${this.ig_did ? this.ig_did : this.deviceId}&is_async_ads_rti=0&is_async_ads_double_request=0&rti_delivery_backend=0&is_async_ads_in_headload_enabled=0&max_id=${max_id}`;
            this.headers.referer = `${this.baseUrl}`;
            this.headers.authority = 'i.instagram.com';
            const register = await this.request.postForm(`${this.baseUrlAPI}api/v1/feed/timeline/`, payloadForm, this.headers);
            return register;
        }catch(e){
            throw new Error(e)
        }

    }

    async sendDmByUsername(username, password, usernameReceiver, message){
        try{
            const allUserId = [];
            await Promise.all(usernameReceiver.map(async data => {
                const {userId} = await this.getProfileByUsername(data);
                allUserId.push(userId);
            }));
            await ig.state.generateDevice(username);
            await ig.account.login(username, password);
            const thread = ig.entity.directThread(allUserId);
            await thread.broadcastText(message);
            
            return 'success';
        }catch(e){
            throw new Error(e)
        }
    }

    async changePassword(oldPassword, newPassword){
        try {
            const dataString = `enc_old_password=${helpers.createEncPassword(oldPassword)}&enc_new_password1=${helpers.createEncPassword(newPassword)}&enc_new_password2=${helpers.createEncPassword(newPassword)}`;
            this.headers.referer = `${this.baseUrl}accounts/password/change/`;
            const register = await this.requestNodeFetch.postResJson(`${this.baseUrl}accounts/password/change/`, dataString, this.headers);
            return register;
        }catch(e){
            throw new Error(e)
        }

    }

    async reportsProfile(userWantToReport, prompType, contextPayload = ''){
        try{
            const resultData = await this._getSharedData(`${this.baseUrl}${userWantToReport}/`, this.headers);
            const schemaUserData = resultData.entry_data.ProfilePage[0].graphql.user;

            const payloadForm = {
                'entry_point': '1',
                'location': '2',
                'object_type': '5',
                'object_id': schemaUserData.id.toString(),
                'container_module': 'profilePage',
                'frx_prompt_request_type': prompType.toString()
            };

            
            let dataString = `entry_point=1&location=2&object_type=5&object_id=${schemaUserData.id}&container_module=profilePage&frx_prompt_request_type=${prompType}`;
            
            if (contextPayload) {
                const dataContext = contextPayload.context.replace(/\\/g, '');
                const sessionId = helpers.getString('session_id":"', '"', dataContext)[1];
                const appId = helpers.getString('app_id":', ',"', dataContext);
                const sentry_feature_map = helpers.getString('sentry_feature_map":"', '"', dataContext)[1];
                const reporterId = helpers.getString('reporter_id":', ',"', dataContext)[1];
                const responsibleId = helpers.getString('responsible_id":', ',"', dataContext)[1];
                delete payloadForm['frx_prompt_request_type'];
                payloadForm.context = `{"tags":[],"ixt_context_from_www":"{\"schema\":\"ig_frx\",\"session\":\"{\\\"location\\\":\\\"ig_profile\\\",\\\"entry_point\\\":\\\"chevron_button\\\",\\\"session_id\\\":\\\"${sessionId}\\\",\\\"tags\\\":[],\\\"object\\\":\\\"{\\\\\\\"user_id\\\\\\\":\\\\\\\"${schemaUserData.id}\\\\\\\"}\\\",\\\"reporter_id\\\":${reporterId},\\\"responsible_id\\\":${responsibleId},\\\"locale\\\":\\\"id_ID\\\",\\\"app_platform\\\":4,\\\"extra_data\\\":{\\\"container_module\\\":\\\"profilePage\\\",\\\"app_version\\\":\\\"None\\\",\\\"is_dark_mode\\\":null,\\\"app_id\\\":${appId},\\\"sentry_feature_map\\\":\\\"${sentry_feature_map}\\\",\\\"shopping_session_id\\\":null,\\\"logging_extra\\\":null,\\\"is_in_holdout\\\":null,\\\"preloading_enabled\\\":null},\\\"frx_feedback_submitted\\\":false,\\\"additional_data\\\":{}}\",\"screen\":\"frx_tag_selection_screen\",\"flow_info\":\"{\\\"nt\\\":null,\\\"graphql\\\":null,\\\"enrollment_info\\\":null,\\\"ig\\\":\\\"{\\\\\\\"ig_container_module\\\\\\\":\\\\\\\"profilePage\\\\\\\"}\\\",\\\"bloks\\\":\\\"{\\\\\\\"initial_screen_id\\\\\\\":null}\\\",\\\"session_id\\\":\\\"${sessionId}\\\"}\",\"previous_state\":null}"}`;
                payloadForm.selected_tag_types = `[${contextPayload.selected_tag_types}]`;
                payloadForm['frx_prompt_request_type'] = prompType.toString();

                dataString = `entry_point=1&location=2&object_type=5&object_id=${schemaUserData.id}&container_module=profilePage&context=${encodeURIComponent(contextPayload.context)}&selected_tag_types=%5B%22${contextPayload.selected_tag_types}%22%5D&frx_prompt_request_type=${prompType}`;

                if (contextPayload.hasOwnProperty('action_type') && contextPayload.hasOwnProperty('selected_tag_types')) {
                    dataString = `entry_point=1&location=2&object_type=5&object_id=${schemaUserData.id}&container_module=profilePage&context=${encodeURIComponent(contextPayload.context)}&selected_tag_types=%5B%22${contextPayload.selected_tag_types}%22%5D&action_type=${contextPayload.action_type}&&frx_prompt_request_type=${prompType}`;
                }

                if (contextPayload.hasOwnProperty('action_type') && !contextPayload.hasOwnProperty('selected_tag_types')) {
                    dataString = `entry_point=1&location=2&object_type=5&object_id=${schemaUserData.id}&container_module=profilePage&context=${encodeURIComponent(contextPayload.context)}&action_type=${contextPayload.action_type}&frx_prompt_request_type=${prompType}`;
                }

                await this.request.postForm(`${this.baseUrl}reports/web/log_tag_selected/`, payloadForm, this.headers);
            }

            this.headers.referer = `${this.baseUrl}/${userWantToReport}/`;
            const result = await this.requestNodeFetch.postResJson(`${this.baseUrl}reports/web/get_frx_prompt/`, dataString, this.headers);
            return result;
        }catch(e){
            throw new Error(e)
        }
    }

}

module.exports = Instagram;
