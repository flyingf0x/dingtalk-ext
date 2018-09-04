钉钉后台审批流程加强插件
===========
## 功能与用途
封装钉钉接口，提供快速构建方法。你可以通过js快捷创建审批流程并在本地保存代码，通过插件提供的input控件引入到页面中执行。达到快速编写、修改方便的目的。

此插件通过油猴运行在浏览器上，[点击这里](https://greasyfork.org/zh-CN/scripts/370565-%E9%92%89%E9%92%89%E5%AE%A1%E6%89%B9%E6%B5%81%E7%A8%8B%E5%8A%A0%E5%BC%BA%E6%8F%92%E4%BB%B6)去到插件安装页。

该插件尚在开发，功能可能仅会围绕本人需要开发，如果发现bug或喜欢本插件需要增添功能，敬请[issues](https://github.com/gogogoghost/dingtalk-ext/issues)

插件运行在后台审批流程管理界面，所有数据与接口都是来自此页面。
## 快速入手
当然公司架构属于机密，下面是乱编的：
```js
(async function(){
    //读取角色缓存
    await sandbox.readRoleList();
    //一个流程列表
    let rules=[];
    //new一个发起人生成器
    let senderGen=sandbox.genSender();
    //加入一个流程
    rules.push({
    	//这是一个条件流程，而不是type 0默认流程
    	type:1,
        //条件
        conds:[
        	//发起人条件：来自总部里面的运营部
        	await senderGen.genUnit('总部->运营部',true),
            //审批表单中报销总额这个值大于1000
            {
            	control: sandbox.searchFromTemplate('报销总额'),
                '>':1000
            },
            //审批表单中报销款项这个单选框是values中之一
            {
            	control:sandbox.searchFromTemplate('报销款项'),
                values:['打车费','物资费']
            }
        ],
        //审批人
        rules:[
            sandbox.searchFromRole('运营总监',true),
            await sandbox.searchFromCompany('张三',0)
        ],
        //抄送人
        notifiers:[
        	//抄送财务部
        	sandbox.searchFromRole('财务部',true)
        ],
    });
    //尝试保存，并获取结果
    let result=await sandbox.saveRule(rules);
    console.log(result);
})();
```
一条简单的审批就这样生成了，你可以使用各类循环、递归等你需要的逻辑花样生成审批流程。

![input图](https://)

## API
api提供了一些属性与方法，其中一部分使用promise封装，名称又比较类似，请仔细阅读文档避免问题。
所有api存放在window.sandbox中，可全局直接调用。
### 属性
sandbox提供了一些数据，一般不用自己访问，sandbox中已经提供了相关接口快速访问。
#### dataBefore
以前的审批数据，格式我一时半会儿也讲不清楚了，反正不用自己访问，以后再补上。

#### template
审批模板数据，包含该审批所有控件，格式我一时半会儿也讲不清楚了，反正不用自己访问，以后再补上。

#### dumplicateList
去重规则列表，包含name与value，当调用修改去重规则的方法时，需要传入要使用的value。

#### saveNotice
审批提醒规则列表，包含name与value，当调用修改审批提示规则的方法时，需要传入要使用的value。

### 方法
方法中提到的原始数据为钉钉原本的数据，不作出解释，需要可以自己打印查看。包装数据为原始数据与另外一些如type之类的属性存放在一起的对象，如：{type:1,obj:obj}。一些方法需要传入包装数据，尽可能使用提供的方法直接生成包装而不是手写。

***
#### readCompanyList(id,name)
读取公司架构中指定ID目录下的数据，注意只能搜索目录，使用Promise。

- id
你需要获取的目录的ID，获取根目录请传-1或者不传。
- name
你需要获取这个目录中的人或目录的名字，传该值则只返回所需名字的对象，不传则返回数组，包含所有数据。

返回的对象为钉钉后台的人物/目录对象
***

### readFrameworkList(str)
从公司架构按所提供的路径字符串进行查找单位，使用Promise

- str
路径字符串，使用->衔接，比如:总部->运营部，最后一个部分支持如下格式:

**总部->运营部->***
获取运营部底下所有数据，返回数组

**总部->运营部->张三**
仅获取张三，返回对象

**总部->运营部->张三/李四**
获取张三与李四，返回数组

返回的对象依然为钉钉后台的人物/目录对象
***

### searchFromCompany(keyword,pack)
根据名字从公司公司架构中搜索，注意只能搜到人，使用Promise
- keyword
关键字
- pack
如果提供该值，且为整数，将从搜索结果中取出对应index的对象，并返回包装数据。如不提供，则返回原始数据数组。

返回包装数据可直接用于审批人、抄送人
***
### readRoleList()
读取角色列表，保存缓存，并返回角色列表，使用Promise

返回角色列表数组，里面为原始数据，一般无需使用此数据。
***

### searchFromRole(name,pack)
从角色列表缓存中查找指定名称的角色，必须先成功调用过一次readRoleList。此方法为同步方法。
- name
角色名
- pack
是否包装该数据，true/false。不传不包装。

返回的包装数据可直接用于审批人/抄送人。
***

### searchFromTemplate(name)
从template(表单列表)中搜索指定名称的控件，供审批条件使用。
- name
控件名称

返回搜索到的控件原始对象
***

### saveConditions(list)
向后端保存该审批所需全部条件，目前未知作用，不调好像也没事，使用Promise
- list
所有条件列表，提供表单中控件的名字，发起人条件请传-1，如：[-1,'款项','数额']

返回服务器返回的数据
***

### saveProcessSetting(value)
向后端保存审批去重规则，使用Promise
- value
从dumplicateList数组中拿到的value。

返回服务器返回的数据
***

### saveNotice(value)
向后端保存审批提示规则，使用Promise
- value
从saveNotice数组中拿到的value。

返回服务器返回的数据
***

### genSender()
返回一个快速构建发起人工具，对象内部会一直保存传入的数据，随时调用gen()获取包装数据，除非调用clear()或者传递指定参数才会清空内部数据，内含方法：

- genUnit(unit,clear)
增加一个单位，使用Promise
unit为readFrameworkList方法参数一样的那种路径表达式
clear为是否清除之前保存在内部的数据,true/false。
方法执行完会返回当前内部数据的包装数据，与gen()逻辑相同。

- genUnitList(unitList,clear)
一样的，只是unitList变成数组了，同样也会返回当前包装数据。

- searchAndGenUnit(unit,index,clear)
该功能尚未测试完善。

- gen()
返回当前内部数据的包装数据

- celar()
清空内部数据
***

### saveRule(rules)
向后端保存整个审批规则，使用Promise
- rules
审批流程数组，有如下数据
> - type 审批类型，0为默认审批，1为判断审批
> - notifiers 抄送者数组
> - rules 审批者数组
> - conds 审批条件数组

#### notifiers/rules
审批人与抄送人数组里的对象应包含下面的数据，一般情况你可以使用各种方法得到这些包装数据而不用手写。
- type
单位类型。0：这是一个人；1：这是一个角色；2：用于审批人，从直属上级一直到这个角色.
- obj
原始数据，现在obj同时支持对象与数组，以兼容多个审批人同时审批。
- act
不传为默认，or：或签，需要一个人同意即可；and：会签，必须所有人同意。

#### conds
条件列表，条件一般需要提供条件来源与满足情况。
- control
条件来源控件，从searchFromTemplate方法或从template数组中获取。
目前支持控件如下：
- 单选框
- 数字输入框
- 金额

>当控件为单选框时需要提供
**values**
单选框满足条件的字符串数组。

>当控件为金额框或数字框时需要提供
**>**
**<**
**>=**
**<=**
**=**
这个不用解释了，指定数量区间

- name -1
当审批条件为审批人时，无需传入control，传入name=-1，随后提供senders

- senders
发起人列表，内容对象为searchFromCompany/readFrameworkList中返回的原始数据，也可使用genSender快速构建，使用genSender构建的数据已经包含了name与senders，可直接作为conds数组成员。

数据检查时发现问题则通过resolve返回
```js
{msg:'错误信息',obj:'相关对象'}
```
开始发送后返回服务器返回的数据
***



