const axios = require('axios');
const fs = require('fs');
const config = require('config');

const {
    base_url,
    topic,
    report_options,
    notify_base_url,
    notify_topic,
} = config;

const url = `${base_url}/${topic}/json?since=5m&poll=1`;
const store_dir_bad=`/tmp/device_report_ntfy/bad`;
const store_dir_good=`${process.env.HOME}/config/device_report_ntfy/good`;

const notify_url = `${notify_base_url}/${notify_topic}`;

const FIVE_MINUTES = 1000*60*5;

(async()=>{

    fs.mkdirSync(store_dir_bad, {recursive:true});
    fs.mkdirSync(store_dir_good, {recursive:true});

    let new_data = (await axios.get(url, report_options)).data
    // let old_data = (await axios.get(url)).data

    new_data = new_data.split('\n').reduce((acc, cur, i, arr)=>{
        
        try{
            cur = JSON.parse(JSON.parse(cur).message);
            cur.date = new Date(cur.date);
            acc.push(cur);
        }catch(e){}

        return acc;

    },[]);

    // return console.log(new_data);

    new_data = arrToObj(new_data, 'device_name');
    new_data = addMissingEntriesFromFs(new_data);

    console.log(Object.keys(new_data));
    console.log(new_data);

    checkTime(new_data);

})();

function checkTime(report_obj){

    const now = (new Date()) - FIVE_MINUTES;

    Object.keys(report_obj).forEach((cur, i, arr)=>{

        const device_name = cur;
        
        if( report_obj[cur] === null ){
            report_obj[cur] = {};
            report_obj[cur].date = 0;
        }
        
        createReportFile(`${store_dir_good}/${device_name}`, device_name);
        
        if(now > report_obj[cur].date){
            console.log(`There was a problem with ${device_name}`);
            const file_loc = `${store_dir_bad}/${device_name}`;
            const already_exists = createReportFile(file_loc, device_name);
            if(!already_exists){
                notify(`Device not reporting in time`, device_name);
            }
        }else{
            console.log(`No issue with ${device_name}`)
            deleteReportFile(device_name);
        }
    });
}

function createReportFile(file_loc, device_name){
    
    const already_exists = fs.existsSync(file_loc);
    
    fs.writeFileSync(file_loc,'report sent');

    return already_exists;
}

function deleteReportFile(device_name){
    const file_loc = `${store_dir_bad}/${device_name}`;
    if(fs.existsSync(file_loc)){
        fs.unlinkSync(file_loc);
    }
}

function arrToObj(arr, obj_key){
    return arr.reduce((acc, cur, i, arr)=>{

        // console.log({acc, cur, i})
        const key = cur[obj_key];

        if( acc[key]===undefined ){
            acc[key] = cur;
        }else if( cur.date > acc[key].date ){
            acc[key] = cur;
        }

        return acc;
    },{});
}

function addMissingEntriesFromFs(device_obj){
    
    const dir_files = fs.readdirSync(store_dir_good);

    dir_files.forEach((cur, i, arr)=>{
        if(device_obj[cur]===undefined){
            device_obj[cur] = null;
        }
    });

    return device_obj;
}

function notify(title, text){
    axios.post(notify_url, text, {headers:{'Title':title}});
}