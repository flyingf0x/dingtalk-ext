// ==UserScript==
// @name         钉钉审批流程加强插件
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  钉钉后台操作麻烦？修改流程要死？现在你可以用js写流程并保存好流程文件，修改与更新只需重新导入一次即可。
// @author       $(ghsot)
// @match        https://aflow.dingtalk.com/dingtalk/web/query/processDesign*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';
    //开始指定指定代码
    let exec=(code)=>{
        eval(code);
    }
    //供外部代码运行的环境
    let sandbox={
        /*
        基本功能区域
        */
        //抓取原数据
        dataBefore:null,
        //抓取模板
        template:null,
        //从模板中搜索一个控件
        searchFromTemplate:null,
        //提供的方法
        //获取指定目录下成员列表，只能搜索到人，根目录不传或传-1
        readCompanyList:null,
        //在公司架构中搜索，可以搜索到部门与人
        readFrameworkList:null,
        //搜索指定成员
        searchFromCompany:null,
        //获取角色列表
        readRoleList:null,
        //从角色缓存列表中查找
        searchFromRole:null,
        //保存条件列表
        saveConditions:null,
        //保存主要条件部分
        saveRule:null,
        //保存审批去重
        saveProcessSetting:null,
        //保存提示规则
        saveNotice:null,
        //去重规则 数组
        duplicateList:null,
        //通知规则 数组
        noticeList:null,
        /*
        加强功能区域
        */
        //快速建立发起人
        genSender:null,
        //快速建立审批条目
        //genRule:null
    };
    window.sandbox=sandbox;
    //内部代码执行闭包
    (function(){
        sandbox.duplicateList=[
            {name:'不自动去重',value:'allow'},
            {name:'同一个审批人在流程中出现多次时，仅保留第一个',value:'no_after'},
            {name:'同一个审批人在流程中出现多次时，仅保留最后一个',value:'no'},
            {name:'仅同一个审批人连续出现时，自动去重',value:'allow_interval'}
        ];
        sandbox.noticeList=[
            {name:'仅全部同意后通知',value:'finish'},
            {name:'仅发起时通知',value:'start'},
            {name:'发起时和全部同意后均通知',value:'start_finish'}
        ];
        //快速建立发起人
        sandbox.genSender=function(){
            let senders=[];
            //添加一个单位 给出完整路径
            this.genUnit=async(unit,clear)=>{
                if(clear){this.clear();}
                let tmp=await sandbox.readFrameworkList(unit);
                if(!tmp){
                    return false;
                }
                if(tmp instanceof Array){
                    senders=senders.concat(tmp);
                }else{
                    senders.push(tmp);
                }
                return this.gen();
            }
            //用于循环调用，添加一个单位组合
            this.genUnitList=async(unitList,clear)=>{
                if(clear){this.clear();}
                let result;
                for(let item of unitList){
                    result=await this.genUnit(item,false);
                    if(!result){return false;}
                }
                return result;
            }
            //搜索并添加一个单位 -1全都要
            this.searchAndGenUnit=async(unit,index,clear)=>{
                if(clear){this.clear();}
                index=index||0;
                let tmp=await sandbox.searchFromCompany(unit,0);
                if(!tmp){
                    return false;
                }
                if(index>=0){
                    senders.push(tmp[index]);
                }else{
                    senders=senders.concat(tmp);
                }
                return this.gen();
            }
            this.gen=()=>{
                return {name:-1,senders:senders};
            }
            this.clear=()=>{
                senders=[];
            }
            return this;
        }
        //快速建立审批条目
        sandbox.genRule=()=>{
        }
        //cookie
        let arr=document.cookie.split(';');
        let cookieObj={};
        for(let item of arr){
            let inner=item.split('=');
            cookieObj[inner[0].replace(/(^\s*)|(\s*$)/g, "")]=inner[1].replace(/(^\s*)|(\s*$)/g, "");
        }
        //hook field
        function field(obj,name,getter,setter){
            let val=obj[name];
            Object.defineProperty(obj,name,{
                get(){
                    val=getter?getter(val):val;
                    return val;
                },
                set(value){
                    val=setter?setter(value,val):val;
                }
            })
        }
        //当前流程process
        let dingProcess;
        //当前流程ID
        let dingId;
        //检查工作是否完成
        let initStarted=false;
        function checkMisson(){
            if(sandbox.dataBefore&&sandbox.template&&!initStarted){
                initStarted=true;
                //向网页中添加元素
                let content=document.getElementsByClassName('approval-page-container')[0];
                let div=document.createElement('div');
                div.innerHTML='<input type="file"><p>加载一个脚本文件开始执行任务</p>';
                let input=div.children[0];
                //给input赋予事件
                input.onchange=()=>{
                    let file=input.files[0];
                    let reader=new FileReader();
                    reader.onload=(res)=>{
                        exec(res.target.result);
                    }
                    reader.readAsText(file);
                }
                content.insertBefore(div,content.children[0]);
            }
        }
        //覆盖fetch
        let fetch=window.fetch;
        window.fetch=null;
        let xhr=window.XMLHttpRequest;
        //封装一个ajax
        let http = {
            qs(data){
                let str = ""
                for(let i in data){
                    if(str)
                    {
                        str+='&';
                    }
                    str += i+'='+data[i];
                }
                return str;
            },
            get(url,data,func){
                let x = new xhr();
                x.onreadystatechange = function(){
                    if(x.readyState== 4){
                        if(x.status==200){
                            func(JSON.parse(x.responseText));
                        }else{
                            func(null);
                        }
                    }
                }
                x.withCredentials=true;
                let str = this.qs(data);
                x.open('GET',url+(str?('?'+str):''),true);
                //x.setRequestHeader('hrm_csrf_token',cookieObj.hrm_csrf_token);
                //x.setRequestHeader('X-csrf-token',cookieObj.csrf_token);
                x.send();
            },
            post(url,data,func,json){
                let x = new xhr();
                x.onreadystatechange = function(){
                    if(x.readyState== 4){
                        if(x.status==200){
                            func(JSON.parse(x.responseText));
                        }else{
                            func(null);
                        }
                    }
                }
                x.withCredentials=true;
                x.open('POST',url,true);
                //x.setRequestHeader('hrm_csrf_token',cookieObj.hrm_csrf_token);
                //x.setRequestHeader('X-csrf-token',cookieObj.csrf_token);
                if(json){
                    x.setRequestHeader('content-type','application/json');
                    //发送
                    x.send(JSON.stringify(data));
                }else{
                    x.setRequestHeader('content-type','application/x-www-form-urlencoded');
                    let str= this.qs(data);
                    x.send(str);
                }
            }
        };
        let searchCache={};
        //从搜索结果中查找
        function searchFromCompanyList(list,name){
            //console.log(list);
            for(let item of list){
                if(item.nodeType==0){
                    if(item.dept.deptName==name){
                        return item;
                    }
                }else if(item.nodeType==1){
                    if(item.employee.orgUserName==name){
                        return item;
                    }
                }
            }
            return null;
        }
        //获取指定目录公司列表
        sandbox.readCompanyList=(id,name)=>{
            id=id||-1;
            return new Promise((resolve,reject)=>{
                //如果有缓存 直接返回
                if(searchCache[id])
                {
                    if(name){
                        resolve(searchFromCompanyList(searchCache[id],name));
                    }else{
                        resolve(searchCache[id]);
                    }
                    return;
                }
                let url='https://oa.dingtalk.com/omp/lwpV2';
                http.get(url,{
                    timestamp:new Date().getTime(),
                    key:'ContactGetOrgNodeList',
                    args:JSON.stringify([id,0,null,0,30,{"appId":-4,"nodeType":2,"type":"w"}])
                },(res)=>{
                    //console.log(res)
                    if(res){
                        searchCache[id]=res.result.values;
                        if(name){
                            resolve(searchFromCompanyList(searchCache[id],name));
                        }else{
                            resolve(searchCache[id]);
                        }
                    }else{
                        reject({});
                    }
                });
            })
        }
        let frameworkCache={};
        //从公司架构中搜索 使用路径发送过来 如"总部->业务线"，"总部->*","总部->运营/事业"将会返回数据数组或者一个item
        sandbox.readFrameworkList=(name)=>{
            if(frameworkCache[name]){
                //找到缓存了
                return frameworkCache[name];
            }
            let list=name.split('->');
            return new Promise(async (resolve,reject)=>{
                //try{
                //一步一步查找
                let tmpList=[];
                for(let i=0;i<list.length;i++){
                    let currentId=i>0?tmpList[i-1].dept.deptId:'-1';
                    //console.log(currentId);
                    if(i==list.length-1){
                        //这是最后一个了
                        let tmp=await sandbox.readCompanyList(currentId);
                        if(!tmp){
                            reject({});
                            return;
                        }
                        tmpList.push(tmp);
                        if(list[i]=='*'){
                            //缓存一下
                            frameworkCache[name]=tmpList[i];
                            //这个目录下所有都要
                            resolve(tmpList[i]);
                            return;
                        }
                        let multiList=list[i].split('/');
                        //console.log(multiList);
                        if(multiList.length>1){
                            let resultList=[];
                            //需要多个东西
                            for(let it of multiList){
                                resultList.push(searchFromCompanyList(tmpList[i],it));
                            }
                            //缓存一下
                            frameworkCache[name]=resultList;
                            resolve(resultList);
                            return;
                        }
                        //仅仅需要一个结果
                        //console.log(tmpList);
                        let result=searchFromCompanyList(tmpList[i],list[i]);
                        //缓存一下
                        frameworkCache[name]=result;
                        resolve(result);
                        return;
                    }else{
                        //还不是最后一个
                        let tmp=await sandbox.readCompanyList(currentId,list[i]);
                        if(!tmp||tmp.nodeType!=0){
                            //搜出来竟然不是目录，返回
                            reject({});
                            return;
                        }
                        tmpList.push(tmp);
                    }
                }
                reject({});
                //}catch(e){console.log(e)}
            })
        }
        let companyUnitCache={};
        //搜索某一个人名字
        sandbox.searchFromCompany=(keyword,pack)=>{
            keyword=keyword||'';
            let get=(list,pack)=>{
                if(!isNaN(parseInt(pack))){
                    //包装出去
                    let unit=list[pack];
                    if(unit){
                        return {type:0,obj:unit};
                    }else{
                        return null;
                    }
                }else{
                    //不包装
                    return list;
                }
            }
            if(companyUnitCache[keyword]){
                //找到缓存了
                return get(companyUnitCache[keyword],pack);
            }
            return new Promise((resolve,reject)=>{
                let url='https://oa.dingtalk.com/omp/lwpV2';
                http.get(url,{
                    timestamp:new Date().getTime(),
                    key:'ContactSearchList',
                    args:JSON.stringify([keyword,0,0,30,{"appId":-4,"type":"w"}])
                },(res)=>{
                    if(res){
                        //缓存一下
                        companyUnitCache[keyword]=res.result.values;
                        let result=get(res.result.values,pack);
                        result?resolve(result):reject({});
                    }else{
                        reject({});
                    }
                    //res!=null?resolve(res.result.values):reject();
                })
            })
        }
        //角色列表缓存
        let roleListCache;
        //获取角色列表
        sandbox.readRoleList=()=>{
            return new Promise((resolve,reject)=>{
                let url='https://oa.dingtalk.com/omp/lwpV2?timestamp=1532164518661&key=LabelGetGroupInfoByPage&args=[null,1,0,100000000]';
                http.get(url,{},(res)=>{
                    if(res){
                        roleListCache=res.result;
                        resolve(res.result);
                    }else{
                        reject({});
                    }
                })
            })
        }
        //保存条件列表 -1 发起人
        sandbox.saveConditions=(list)=>{
            let sendList=[];
            let data={};
            data.processCode=dingProcess;
            for(let item of list){
                if(item==-1){
                    //发起人条件
                    sendList.push({id:'dingtalk_origin_dept',label:'发起人',type:'dept',value:[]});
                }else{
                    //自定义模板条件
                    for(let temp of sandbox.template){
                        if(temp.props.label==item){
                            //找到了
                            sendList.push({id:temp.props.id,label:item,type:temp.props.options?'value':'range',value:[]});
                            break;
                        }
                    }
                }
            }
            //console.log(sendList);
            data.conditionRule=JSON.stringify(sendList);
            return new Promise((resolve,reject)=>{
                http.post('https://aflow.dingtalk.com/dingtalk/web/query/rule/setConditionRule.json',data,(res)=>{
                    res!=null?resolve(res):reject({});
                })
            })
        }
        //从角色中查找 缓存
        sandbox.searchFromRole=(name,pack,act)=>{
            if(roleListCache){
                for(let item of roleListCache){
                    if(item.labels){
                        for(let child of item.labels){
                            if(name==child.name){
                                if(pack){
                                    let result={type:1,obj:child};
                                    if(act){result.act=act;}
                                    return result;
                                }else{
                                    return child;
                                }
                            }
                        }
                    }
                }
            }
            return null;
        }
        //从模板中搜索一个控件
        sandbox.searchFromTemplate=(name)=>{
            for(let item of sandbox.template){
                if(item.props.label==name){
                    return item;
                }
            }
            return null;
        }
        //保存主要规则数据
        //单位类型
        //target_approval          0一个人
        //target_label             1一个组
        //target_managers_labels   2从直属上级一直到该组 levels:[1]
        const humanList=[
            'target_approval',
            'target_label',
            'target_managers_labels'
        ];
        /*
        0 选择框 paramValues为符合条件的所有选项数组
        1 数字框
        */
        const condList=[
            {
                //发起人条件
                name:-1,
                type:'dingtalk_actioner_dept_condition',
                id:'dingtalk_origin_dept',
                label:'发起人'
            },
            {
                //金额输入
                name:'MoneyField',
                type:'dingtalk_actioner_range_condition'
                //classAlias:'DingTalkActionerRangeConfExtensionD0'
            },
            {
                //单选框
                name:'DDSelectField',
                type:'dingtalk_actioner_value_condition'
                //classAlias:'DingTalkActionerValueConfExtensionD0'
            },
            {
                name:'NumberField',
                type:'dingtalk_actioner_range_condition'
            }
        ];
        /*
        rule:
        type 0 默认规则 1判断规则
        notifiers 抄送者
            type 类型
            obj 搜索出来的角色或者人物
        rules 规则
            type 类型
            obj 搜索出来的角色或者人物
            act 审批类型，不传：默认，用户自己选择；or:其中一人同意即可；and:所有人同意才OK type为1时起作用
        conds 其他条件
            control 控件
            values 如果是选择框，提供满足选择的list
            >  如果是数字输入框，提供数字区间，5个key可供使用
            >=
            <
            <=
            ==
            senders 如果是发起人，给个数组
                从searchFromCompany或者readFrameworkList中返回的对象数组
        */
        sandbox.saveRule=(rules)=>{
            //try{
            let data={};
            data.id=dingId;
            data.processCode=dingProcess;
            data.ruleType='dingtalk_multi_actioner';
            let content={};
            content.rules={type:'dingtalk_actioner',rules:[]};
            content.type='dingtalk_multi_actioner';
            content.multiRules=[];
            let defaultCount=0;
            //一旦有错误 立即返回 包含msg obj
            let error;
            //处理审批人/抄送人
            let dealList=(src,dest)=>{
                for(let item of src){
                    //console.log(item)
                    if(!item){
                        error={msg:'审批/抄送拿到了null，返回整个列表',obj:src};
                        return;
                    }
                    let n={};
                    n.type=humanList[item.type];
                    if(!n.type){
                        error={msg:'审批/抄送为不支持的单位类型，返回整个列表',obj:src};
                        return;
                    }
                    if(!item.obj){
                        error={msg:'审批/抄送中有空的对象，返回整个列表',obj:src};
                        return;
                    }
                    //加入actType
                    if(item.act){
                        n.actType=item.act;
                    }
                    switch(item.type){
                        case 0:
                            //一个人
                            n.approvals=[];
                            if(item.obj instanceof Array){
                                console.log(item.obj);
                                for(let child of item.obj){
                                    if(!child.employee||!child.employee.orgStaffId){
                                        error={msg:'无效的数据，返回该对象',obj:child};
                                        return;
                                    }
                                    n.approvals.push(child.employee.orgStaffId);
                                }
                            }else{
                                n.approvals.push(item.obj.employee.orgStaffId);
                            }
                            break;
                        case 1:
                        case 2:
                            //一个角色
                            n.labels=[];
                            n.labelNames=[];
                            if(item.obj instanceof Array){
                                for(let child of item.obj){
                                    n.labels.push(child.id);
                                    n.labelNames.push(child.name);
                                }
                            }else{
                                n.labels.push(item.obj.id);
                                n.labelNames.push(item.obj.name);
                            }
                            break;
                        default:
                            error={msg:'有不支持的审批/抄送单位类型，返回出错对象',obj:item};
                            return;
                            break;
                    }
                    dest.push(n);
                }
            }
            //递归处理条件
            let addCond=(list,rules,notifiers,status)=>{
                let content={};
                let cond=list.shift();
                //计算出index
                let index=0;
                //console.log(cond);
                let name=cond.name||(cond.control?cond.control.componentName:'');
                if(!name){
                    error={msg:'无效的判断条件数据，返回出错对象',cond};
                    return;
                }
                for(let item of condList){
                    if(name==item.name){
                        break;
                    }
                    index++;
                }
                //console.log(index);
                if(index>=condList.length){
                    error={msg:'有不支持的条件控件，返回出错对象',obj:cond};
                    return;
                }
                //加入数据
                //content.classAlias=condList[index].classAlias;
                content.type=condList[index].type;
                content.exclMgrDeptsDepth=0;
                content.status=status;
                status=status||1;
                content.paramKey=condList[index].id||cond.control.props.id;
                content.paramLabel=condList[index].label||cond.control.props.label;
                content.isEmpty=false;
                switch(index){
                    case 0:
                        content.conds=[];
                        for(let sender of cond.senders){
                            let n={};
                            if(sender.nodeType==1){
                                n.value=sender.employee.orgId+'';
                                n.type='user';
                                n.attrs={
                                    name:sender.employee.orgUserName,
                                    avatar:''
                                }
                            }else{
                                n.value=sender.dept.deptId+'';
                                n.type='dept';
                                n.attrs={
                                    name:sender.dept.deptName,
                                    memberCount:sender.dept.memberCount
                                }
                            }
                            content.conds.push(n);
                        }
                        break;
                    case 1:
                    case 3:
                        content.upperBound=cond['<']||'';
                        content.lowerBoundNotEqual=cond['>']||'';
                        content.lowerBound=cond['>=']||'';
                        content.bondEqual=cond['=']||'';
                        content.upperBoundEqual=cond['<=']||'';
                        content.key='g';
                        break;
                    case 2:
                        content.paramValues=cond.values;
                        content.oriValue=cond.control.props.options;
                        break;
                }
                //抄送人
                content.notifiers=notifiers;
                //规则
                content.rules=rules;
                //继续递归
                if(list.length>0){
                    //还有数据，继续递归
                    content.multiRules=[addCond(list,rules,notifiers,status)];
                }
                return content;
            }
            //开始处理数据
            for(let rule of rules){
                let item={};
                //抄送者
                let notifiers=[];
                dealList(rule.notifiers,notifiers);
                if(error){return error;}
                //审批者
                let rules=[];
                dealList(rule.rules,rules);
                if(error){return error;}
                //判断是否是默认
                if(rule.type==0){
                    //默认
                    item.type='dingtalk_actioner_default';
                    item.rules=rules;
                    item.notifiers=notifiers;
                    //未知值 写死0
                    item.exclMgrDeptsDepth=0;
                    //状态值 写死0
                    item.status=0;
                    defaultCount++;
                    continue;
                }
                //不是默认，开始处理
                if(rule.conds&&rule.conds.length>0){
                    item=addCond(rule.conds,rules,notifiers,0);
                    if(error){return error};
                }
                content.multiRules.push(item);
            }
            if(defaultCount==0){
                //需要帮忙加一个空的进去
                let defaultList=[];
                defaultList.push({
                    type:'dingtalk_actioner_default',
                    exclMgrDeptsDepth:0,
                    rules:[],
                    notifiers:[],
                    status:0
                });
                content.multiRules=defaultList.concat(content.multiRules);
            }
            console.log(content);
            //return;
            data.ruleConf=JSON.stringify(content);
            return new Promise((resolve,reject)=>{
                http.post('https://aflow.dingtalk.com/dingtalk/web/query/rule/setRuleConfInfo.json',data,(res)=>{
                    res!=null?resolve(res):reject({});
                })
            })
            //}catch(e){console.log(e);}
        }
        //保存去重设置
        sandbox.saveProcessSetting=(duplicate_approval)=>{
            let data={};
            data.processCode=dingProcess;
            let settings=[];
            settings.push({type:'proc_append_enable',value:'n'});
            settings.push({type:'proc_duplicate_approval',value:duplicate_approval});
            data.settings=JSON.stringify(settings);
            return new Promise((resolve,reject)=>{
                http.post('https://aflow.dingtalk.com/dingtalk/web/query/process/setProcessSetting.json',data,(res)=>{
                    res!=null?resolve(res):reject({});
                })
            })
        }
        //保存提示信息
        sandbox.saveNotice=(rule)=>{
            let data={};
            data.processCode=dingProcess;
            data.noticePosition=rule;
            return new Promise((resolve,reject)=>{
                http.post('https://aflow.dingtalk.com/dingtalk/web/query/notice/setNoticePosition.json',data,(res)=>{
                    res!=null?resolve(res):reject({});
                })
            })
        }
        //放入window开始测试
        //window.testFunc=readRoleList;
        //开始代理原类
        window.XMLHttpRequest=function(){
            let obj=new xhr();
            //内部的任务开关
            let catchDataBefore=false;
            let catchTemplate=false;
            //代理所有内容
            for(let key in obj){
                if(typeof obj[key]=='function'){
                    switch(key){
                        case 'open':
                            this[key]=open;
                            break;
                        case 'send':
                            this[key]=send;
                            break;
                        default:
                            this[key]=function(){
                                obj[key].apply(obj,arguments);
                            }
                            break;
                    }
                }else{
                    field(this,key,function(){
                        //当数据被获取时，也同时获取一份
                        switch(key){
                            case 'response':
                                //获取之前数据
                                if(catchDataBefore){
                                    catchDataBefore=false;
                                    let data=JSON.parse(obj.responseText);
                                    sandbox.dataBefore=JSON.parse(data.data.ruleConf);
                                    dingProcess=data.data.name;
                                    dingId=data.data.id;
                                    //console.log(dingProcess,dingId);
                                    checkMisson();
                                    //print('规则数据',dataBefore);
                                }
                                //获取模板
                                if(catchTemplate){
                                    catchTemplate=false;
                                    let data=JSON.parse(obj.responseText);
                                    let inner=JSON.parse(data.data.content);
                                    sandbox.template=[];
                                    for(let item of inner.items){
                                        if(item.props.required)
                                        {
                                            sandbox.template.push(item);
                                        }
                                    }
                                    checkMisson();
                                    //print('模板',template);
                                }
                                break;
                        }
                        return obj[key];
                    },function(val){
                        obj[key]=val;
                    })
                }
            }
            //open方法
            function open(){
                //console.log('execexec');
                //抓取原数据
                if(arguments[1].indexOf('getProcessRuleConfInfo.json')>=0&&!sandbox.dataBefore){
                    sandbox.dataBefore=1;
                    catchDataBefore=true;
                }
                //抓取审核模板
                if(arguments[1].indexOf('getForm.json')>=0&&!sandbox.template){
                    //console.log('我执行了');
                    sandbox.template=1;
                    catchTemplate=true;
                }
                //执行原方法
                obj.open.apply(obj,arguments);
            }
            //send方法
            function send(){
                obj.responseType='';
                obj.send.apply(obj,arguments);
            }
        };
    })();
})();
