/*
 visual tag service which handle request from portal
 */
!function() {
  /*****************
   Common functions
  ******************/
  // 为了避免匹配到visual tag本身的class，而定义的正则常量
  var _CLASS_PREFIX = "dtm-web-visual-";
  var AVOID_VT_CLASS = new RegExp(_CLASS_PREFIX + "(?:sd-tag|sd-para|sim-eleTag|sim-elePara-range)", "g");

  // 计算同类元素的父元素
  function querySimEleParent(list) {
    var parentNode = undefined;
    var paramList = Array.prototype.slice.call(list);
    // list 可能有纵向三个、横向三个或纵横九个
    // 遍历第一个元素的parent
    while(paramList[0] && paramList[0].parentNode) {
      // 遍历list里的元素
      var hasSameParent = true;
      for (var x = 0; x < paramList.length; x ++) {
        // 必须全部都等时，才是最终的parent
        for (var y = 1; y < paramList.length - 1; y ++) {
          if (paramList[x].parentNode !== paramList[y].parentNode) {
            hasSameParent = false;
          }
        }
        if (hasSameParent) {
          parentNode = paramList[x].parentNode;
          return parentNode;
        }
      }

      for (var z = 0; z < paramList.length; z ++) {
        paramList[z] = paramList[z].parentNode;
      }
    }
    
    return parentNode;
  }

  // 查询同类元素参数路径
  function querySimEleParaPath(path, rangePath) {
    var orgPath = path;
    var lastPath = orgPath.indexOf(rangePath) === 0 ? orgPath.slice(rangePath.length) : undefined;
    var simEleParaChildPath = '';
    // 当埋点元素于range相同时，两个路径由于取法不同会出错，做同化处理
    if (lastPath === undefined) {
        while(orgPath.indexOf(":nth-of-type") !== -1) {
            if(document.querySelector(rangePath + orgPath.slice(orgPath.indexOf(":nth-of-type"))) && document.querySelector(rangePath + orgPath.slice(orgPath.indexOf(":nth-of-type"))).isEqualNode(document.querySelector(path))) {
                lastPath = orgPath.slice(orgPath.indexOf(":nth-of-type"));
                simEleParaChildPath = lastPath.slice(lastPath.indexOf(":nth-of-type") + 15);
                break;
            }
            orgPath = orgPath.slice(orgPath.indexOf(")") + 1);
        }
    } else {
        simEleParaChildPath = lastPath.slice(lastPath.indexOf(")") + 1);
    }

    return {
        simElePath: rangePath + simEleParaChildPath,
    };
  }

    // 查询同类元素路径
  function querySimilarElePath(el, queryParamRange) {
    // 原始路径
    var orgPath = queryCssPath(el);
    // 最右端":nth-of-type"之前的路径
    var firstPath = orgPath.slice(0, orgPath.lastIndexOf(":nth-of-type"));
    // 最右端":nth-of-type"之后的路径
    var lastPath = orgPath.slice(orgPath.lastIndexOf(")") + 1);
    var hasSimilarEles = false;

    //  最右端":nth-of-type()"内的数字
    // 路径内含有nth节点、不与自己进行比较、且这个路径下的元素是存在的
    if (orgPath.lastIndexOf(":nth-of-type") !== -1 && (document.querySelectorAll(firstPath+ lastPath).length) > 1) {
      hasSimilarEles = true;
    };

    while (firstPath.lastIndexOf(":nth-of-type") !== -1 && !hasSimilarEles) {
      firstPath = firstPath.slice(0, firstPath.lastIndexOf(":nth-of-type"));
      lastPath = orgPath.slice(firstPath.length).slice(orgPath.slice(firstPath.length).indexOf(")") + 1);
      if (document.querySelectorAll(firstPath + lastPath).length > 1) {
          hasSimilarEles = true;
          break;
      };
    }
    
    if (hasSimilarEles) {
        return queryParamRange ? firstPath : (firstPath + lastPath);
    }
    return undefined;
  }

  // 同级节点比较
  function compareSameLevelEl(el, selector) {
      var sameObj = {
          currNodeSite: 1,
          sameEls: [],
          uniqClass: "",
          sameClass: ""
      }
      // 所有兄弟节点
        var childElNode = el.parentNode ? el.parentNode.children : undefined;
      // 查询同类型兄弟节点
      var sameElNode = el.previousElementSibling;
      // 查询兄弟节点
      var sibElNode = el.previousElementSibling;
      // 兄弟节点所有类名
      var sibClasses = [];
      // 记录当前元素于所有兄弟节点的位置
      var thisElIndex = 0;
        // 当前选中元素class并去重
        var thisClass = Array.from(new Set(el.className.replace(AVOID_VT_CLASS, "").split(' ')));
      // 定位次元素在父类所有子元素的index
      for (var i = 0; i < childElNode.length; i++) {
          if (sibElNode) {
              thisElIndex++;
              sibElNode = sibElNode.previousElementSibling;
          }
      }

      // 遍历所有此元素的同类元素
      for (var i = 0; i < childElNode.length; i++) {
          // 当前元素父节点的所有子元素class
          var childClass = childElNode[i].className.replace(AVOID_VT_CLASS, "").split(' ');

          // 取除本身以外的所有sibling的类名
          if (thisElIndex !== i) {
              Array.prototype.push.apply(sibClasses, childClass);
          }

          // 记录所有同类型兄弟节点放入sameEls数组
          if (childElNode[i].nodeName.toLowerCase() === selector) {
              sameObj.sameEls.push(childElNode[i]);
          }
          // 定位此元素在同类元素中的位置   指定类型元素的第n个
          if (sameElNode && (sameElNode.nodeName.toLowerCase() === selector)) {
              sameObj.currNodeSite++;
              sameElNode = sameElNode.previousElementSibling;
          } else if (sameElNode) {
              sameElNode = sameElNode.previousElementSibling;
          }
      }

      for(var i = 0; i < thisClass.length; i++){
          if(thisClass[i]==''){
              thisClass.splice(i, 1);
              i--;
          }
      }

      sameObj.uniqClass = findAvailableClass(thisClass, sibClasses).uniq;
      sameObj.sameClass = findAvailableClass(thisClass, sibClasses).same;
      return sameObj;
  }

  // 选取类名: 类名唯一时取唯一类名，否则取重复类名
  function findAvailableClass(thClass, classes) {
      var className = {
          uniq: "",
          same: ""
      }

      // 对非法class名进行筛选，如果选中元素有合法类名取合法类名，若没有取非法类名
      // 例如class="123a bbb$ ccc"取"ccc";
      // class="123a bbb$"取最后一个非法类名;
      // 只有一个非法类名时取该非法类名
      var flag = new RegExp("^[0-9]|[~!@#$%^&*()\+=<>?:\"{}|,.\/;'\\[\]·~！@#￥%&*（）\+={}|《》？：“”【】、；‘'，。、]");
      for (var i = 0; i < thClass.length; i++) {
          // 当类名中含有非法类名，且不全为非法类名时，从类名数组中剔除；若全为非法类名（即被剃的只剩一个非法类名）时，取该（最后一个）非法类名
          if(flag.test(thClass[i]) && thClass.length > 1) {
              thClass.splice(i, 1);
              i--;
          }
      }

      for (var i = 0; i < thClass.length; i++) {
          if (thClass[i] !== "") {
              if (classes.indexOf(thClass[i]) !== -1) {
                  className.same = thClass[i];
              } else {
                  className.uniq = thClass[i];
              }
          }
      }

      return className;
  }

  // 从右往左遍历原数组，原数组打散，分到每个类型的节点数组里
  function splitOriginPathArr(originPathArr, objArr, pathArrsObj) {
      for (var i = originPathArr.length - 1; i >= 0; i--) {
          objArr[i] = {
              item: originPathArr[i],
              index: i
          }
          // 如果有id，必为首节点（外层进行了截断），有且只有一个
          if (originPathArr[i].indexOf("#") !== -1) {
              pathArrsObj.idNode.push(objArr[i]);
          } else if (originPathArr[i].indexOf(":nth-of-type") !== -1) {
              pathArrsObj.nthArr.push(objArr[i]);
          } else if (originPathArr[i].indexOf(".") !== -1) {
              pathArrsObj.classArr.push(objArr[i]);
          } else {
              pathArrsObj.nodeArr.push(objArr[i]);
          }
      }
  }

  // 判断前后两个节点的关系“  ”或“ > ”
  function confirmConnector(prevIndex, nextIndex) {
      return prevIndex === (nextIndex - 1) ? " > " : "  ";
  }

  // 将新路径数组拼接成字符串
  function concatNewPath(pathArr) {
      var newPath = pathArr[0] ? pathArr[0].item : "";
      for (var i = 0; i < pathArr.length - 1; i++) {
          newPath = newPath + confirmConnector(pathArr[i].index, pathArr[i + 1].index) + pathArr[i + 1].item
      }
      return newPath;
  }

  // nth节点是关键，且关联同类元素，须遍历完，因此可以抽出；之后的id、class、node是一边插入一边判断唯一后跳出，因此不做抽象
  // TODO: 给用户提供选择的余地，任一个nth节点的nth属性都可删除，每一条都进行圈选显示
  function buildNthNodesPath(pathArrsObj, leafNode, newPath, newPathArr) {
      // 有nth节点 且 nth数组的第一项不是叶子节点
      if (pathArrsObj.nthArr[0] && pathArrsObj.nthArr[0].index !== leafNode.index || !pathArrsObj.nthArr[0]) {
          newPathArr.unshift(leafNode);
      }

      // 循环将nth节点插进数组
      for (var i = 0; i < pathArrsObj.nthArr.length; i++) {
          newPathArr.unshift(pathArrsObj.nthArr[i]);
      }

      newPath = concatNewPath(newPathArr);
      return newPath
  }

  // 判断路径是否唯一 且 长度大于3
  function approvedSelectorPath(newPath) {
    var isRangeUniq = true;
    var arrOfNewPath = newPath.replace(/>/g, "").split("  ");

    // 初步判断如果有range，range路径的第一个元素是否唯一
    if(newPath.lastIndexOf(":nth-of-type") !== -1){
      isRangeUniq = document.querySelectorAll(newPath.slice(0, newPath.lastIndexOf(":nth-of-type")) + ":nth-of-type(1)").length === 1;
    } 
    return isRangeUniq && document.querySelectorAll(newPath).length === 1 && (arrOfNewPath.length >= 3);
}

  // 简化路径
  function simplifyPath(path) {
      // 根据原始path数组建立一个新数组
      var originPathArr = path.slice();
      // 用来记录名称和index的对象数组
      var objArr = [];
      // 新路径的数组对象，用来存放nth节点数组、class节点数组、node节点数组、id节点数组
      var pathArrsObj = {
          nthArr: [],
          classArr: [],
          nodeArr: [],
          idNode: []
      };
      // 返回的简化后的新路径
      var newPath = "";
      var newPathArr = []
      // 用来连接节点与节点之间的符号“  ”或“ > ”
      var connector = "";
      // 叶子节点
      var leafNode = {
          item: originPathArr[originPathArr.length - 1],
          index: originPathArr.length - 1
      };

      //如果叶子节点是id节点，直接取id
      if (leafNode && leafNode.item.indexOf("#") !== -1) {
          return newPath = path.join("");
      }

      // 从右往左遍历原数组，原数组打散，分到每个类型的节点数组里
      splitOriginPathArr(originPathArr, objArr, pathArrsObj);

      // 首轮链接叶子节点和nth节点
      newPath = buildNthNodesPath(pathArrsObj, leafNode, newPath, newPathArr);

      if (approvedSelectorPath(newPath)) {
          return newPath;
      };


      // 当原path提取nth-of-type后路径仍不唯一，需要往空隙间添加class节点或node节点

      // 插入id节点
      if (pathArrsObj.idNode.length > 0) {
          newPathArr.unshift(pathArrsObj.idNode[0]);
          newPath = concatNewPath(newPathArr);
          if (approvedSelectorPath(newPath)) {
              return newPath;
          };
      }

      var newPathArrForNode = newPathArr.slice();

      // 插入class节点
      for (var i = 0; i < pathArrsObj.classArr.length; i++) {
          // 与原节点位置进行比较，在适当位置插入
          for (var j = newPathArr.length - 1; j >= 0; j--) {
              if (pathArrsObj.classArr[i].index < newPathArr[j].index && (j === 0 || pathArrsObj.classArr[i].index > newPathArr[j - 1].index)) {
                  newPathArr.splice(j, 0, pathArrsObj.classArr[i])
              }
          }
          newPath = concatNewPath(newPathArr);
          if (approvedSelectorPath(newPath)) {
              return newPath;
          };
      }

      // 或插入node节点
      for (var i = 0; i < pathArrsObj.nodeArr.length; i++) {
          // 与原节点位置进行比较，在适当位置插入
          for (var j = newPathArrForNode.length - 1; j >= 0; j--) {
              if (pathArrsObj.nodeArr[i].index < newPathArrForNode[j].index && (j === 0 || pathArrsObj.nodeArr[i].index > newPathArrForNode[j - 1].index)) {
                  newPathArrForNode.splice(j, 0, pathArrsObj.nodeArr[i])
              }
          }
          newPath = concatNewPath(newPathArrForNode);
          if (approvedSelectorPath(newPath)) {
              return newPath;
          };
      }

      // 或插入class和node节点
      for (var i = 0; i < pathArrsObj.nodeArr.length; i++) {
          // 与原节点位置进行比较，在适当位置插入
          for (var j = newPathArr.length - 1; j >= 0; j--) {
              if (pathArrsObj.nodeArr[i].index < newPathArr[j].index && (j === 0 || pathArrsObj.nodeArr[i].index > newPathArr[j - 1].index)) {
                  newPathArr.splice(j, 0, pathArrsObj.nodeArr[i])
              }
          }
          newPath = concatNewPath(newPathArr);
          if (approvedSelectorPath(newPath)) {
              return newPath;
          };
      }

      // 如果仍不唯一，基本是body的子节点，直接用原路径
      newPath = path.join(" > ");
      return newPath;
  }

  // 查询css路径
  function queryCssPath(el) {
      var path = [];
      if (!(el instanceof Element)) {
          return;
      }

      while (el.nodeType === Node.ELEMENT_NODE) {
          var selector = el.nodeName.toLowerCase();

          if (el.id) {
              // 存在ID 直接返回ID作为首节点
              selector = '#' + el.id;
              path.unshift(selector);
              break;
          } else {
                var sameObj = compareSameLevelEl(el, selector)

                if (sameObj.uniqClass) {
                    selector += ('.' + sameObj.uniqClass);
                } else if (sameObj.sameEls.length > 1) {
                    if (sameObj.sameClass) {
                        selector += ('.' + sameObj.sameClass);
                  }
                    selector += (':nth-of-type(' + sameObj.currNodeSite + ')');
              }

              path.unshift(selector);
              el = el.parentNode;
          }
      }

      var pathStr = path.join(' > ');
        try{
            document.querySelectorAll(pathStr);
            // 当且仅当class内含有“\”时，document.querySelectorAll(pathStr).length === 0，直接抛异常。不然代码本身不抛
            if(document.querySelectorAll(pathStr).length === 0) {
              throw pathStr;
            }
            return simplifyPath(path);
        } catch (exp){
            throw pathStr;
        }
  };

    /**
   * if element is out of param range
   * @param {*} element element
   * @note element is out of similar element param range
   */
  function isOutOfSimEleRange(element) {
    while (element) {
        if (element.classList) {
            for(var i = 0; i < element.classList.length; i++) {
                if(element.classList[i].indexOf("dtm-web-visual-sim-elePara-range") !== -1) {
                    return false;
                }
            }
        }
      element = element.parentNode;
    }
  
    return true;
  }

  /**
   * if element is button style
   * @param {*} element element
   * @note type of button tag is submit or button always
   */
  function isElementButton(element) {
    var type =  element.type && element.type.toLowerCase();
    if (['button','submit','reset'].indexOf(type) !== -1) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * if element is A tag
   * @param {*} element element
   */
  function isElementLink(element) {
    var tagName = element.tagName.toUpperCase();
    return tagName === 'A' ? true : false;
  }

    /**
   * if element is password tag
   * @param {*} element element
   */
  function isElementPassword(element) {
    return element.tagName === "INPUT" && element.type === "password" ? false : true;
  }
  /**
   * get offset from document(rather than viewport)
   * @param {*} el element
   * @return  element's {top,left} related to document{top, left}
   */
  function getOffset(el) {
    var box = el.getBoundingClientRect();
    // 减去body的偏移值
    var body = parentDom.getBoundingClientRect();
    return {
      top: (box.top - body.top),
      left: (box.left - body.left)
    };
  }

  /**
   * 计算获取当前文档高度
   */
  function getDocumentHeight() {
    var body = parentDom;

    return body.offsetHeight > body.scrollHeight ? body.offsetHeight : body.scrollHeight;
  }

  /**
   * 计算获取当前文档宽度
   */
  function getDocumentWidth() {
    var body = parentDom;

    return body.offsetWidth > body.scrollWidth ? body.offsetWidth : body.scrollWidth;
  }

  /**
   * 确认element是蒙层或选择框（或其子孙）
   * @param {*} element
   * @return true： 是; 否则false
   */
  function isWithinVisualDom(element) {
    var elementList = document.querySelectorAll(VisualDom.prototype.CLASS_TAG);
    for (var a = 0; a < elementList.length; a++) {
      if (elementList[a] === element) {
        return true;
      } else {
        if ( elementList[a].contains(element) ) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * poseMessage to portal
   * @param {*} code the code present the message, it is request cmd if response, and notify code if notify
   * @param {*} options an object include all the properties portal needed
   */
  function responseToPortal(code, options) {
    // append url anyway
    options['url'] = window.location.href;
    window.parent && window.parent.postMessage({
      'type': 'response',
      'code': code,
      'options': options}, "*");
  }

  /**
   * 为了渲染埋点tag，预先添加css片段:dtm-web-visual-tag 和 dtm-web-visual-params
   * 渲染埋点和参数的同类元素，预先添加css片段：dtm-web-visual-tagSimEle 和 dtm-web-visual-paramsSimEle
   */
  function loadCssCode() {
    var code ='.dtm-web-visual-sd-tag{box-shadow: 0px 0px 3px 3px #0070f0 !important}.dtm-web-visual-sd-para{box-shadow: 0px 0px 3px 3px #22c272}.dtm-web-visual-sim-eleTag{outline: 3px dashed #0070f0 !important}.dtm-web-visual-sim-elePara-range{outline: 3px dashed #22c272 !important}';
    var style = document.createElement('style');
    style.type = 'text/css';
    style.rel = 'stylesheet';
    //for Chrome Firefox Opera Safari
    style.appendChild(document.createTextNode(code));
    //for IE
    var head = document.getElementsByTagName('head')[0];
    head.appendChild(style);
  }

  /**
   * build selected detail information of element
   * @param {*} element dom element specified
   * @return the element information
   */
  function buildSelectedInfo(element) {
    try {
        var cssPath = queryCssPath(element) || "";
        // 同类元素路径必传
        var simEleCssPath = querySimilarElePath(element, false) || "";
        var simEleParaRange = querySimilarElePath(element, true) || "";
      return {
          eleText: trimText.truncate(differTagName(element)),
          type: 4, // default is css
          path: cssPath,
          // 若无同类元素，undefined
          simEleCssPath: simEleCssPath,
          simEleParaRange: simEleParaRange,
      };
    } catch (exception) {
      console.warn("[visual] Selected css path contains illegal id or class!");
      return {
        eleText:"",
        type: -1, // default is css
        path: exception,
        // 若无同类元素，undefined
        simEleCssPath: "",
        simEleParaRange: "",
      };
    }
  }

  function differTagName(el) {
    if ((el.tagName === "INPUT" && el.type !== "password") || el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
      return el.value || "";
    }else{
      return el.innerText;
    }
  }
    
  /*********************
   * Objects definition
   *********************/
  /**
   *  trim text before post to portal
   */
  var trimText = {
    // portal needs only 0~99
    MAX_SIZE: 99,
    truncate: function(input) {
      var result;
      if (typeof input === 'string') {
        result = input.substring(0, this.MAX_SIZE);
      }
      return result || "";
    }
  };

  /**
   * 控制被选中的DOM的样式
   */
  var selectedDom = {
    // class as const
    _CLASS_TAG: _CLASS_PREFIX + "sd-tag",
    _CLASS_PARAM: _CLASS_PREFIX + "sd-para",
    _CLASS_TAGSIMELE: _CLASS_PREFIX + "sim-eleTag",
    _CLASS_PARAMSIMELE: _CLASS_PREFIX + "sim-elePara-range",

    /**
     * return query list which matches the path
     * @param path
     * @return matched list or []
     * @note portal request with unique cssPath, so try getElementById firstly
     */
    queryCssPath: function(path) {
      var list;
      // if path is a string with # as prefix
      var element;
      if (typeof path === 'string' && path[0] === '#') {
        element = document.getElementById(path.substring(1));
      }
      if (element) {
        list = [];
        list[0] = element;
      } else {
      // then query by selector
        try {
          list = document.querySelectorAll(path);
        } catch (exception) {
          list = [];
          console.warn("[visual] css path is ineligible");
        }
      }
      return list;
    },

    // element.classList 里只能持有唯一的_CLASS_PREFIX打头样式
    // so utilize dvtClassListStack.push(）to store previous _CLASS_PREFIX
    _removeClassList: function(element) {
      for (var i = 0; i < element.classList.length; i ++) {
        if (element.classList[i].indexOf(_CLASS_PREFIX+"sd-") !== -1) {
          // once find _CLASS_PREFIX，push to dvtClassListStack
          element.dvtClassListStack = element.dvtClassListStack || [];
          Array.prototype.push.call(element.dvtClassListStack, element.classList[i]);
          // then remove item
          element.classList.remove(element.classList[i]);
          i --;
        }
      }
    },

    // just dvtClassListStack.pop one possible _CLASS_PREFIX to classList
    // note:  do nothing if dvtClassListStack is empty
    _restoreClassList: function(element) {
      var item = element.dvtClassListStack && Array.prototype.pop.call(element.dvtClassListStack);
      item && element.classList.add(item);
    },

    // dvtClassListStack不是严格的stack, 也就是push pop不是完全配对的，
    // 有可能cancel操作的css 并不在classList中，则从dvtClassListStack中从后向前匹配并清理一个
    _cleanItemInClassList: function(element, classStr) {
      var length = element.dvtClassListStack && element.dvtClassListStack.length;
      if (length > 0) {
        for(var i = (length-1); i >= 0; i--) {
          if (element.dvtClassListStack[i] === classStr) {
            Array.prototype.splice.call(element.dvtClassListStack, i, 1);
            break;
          }
        }
      }
    },
    /**
     * 给tag节点添加指定css path的 选中样式
     * @param path css path
     * @return matched elements
     */
    addSelectedTagDom: function(path) {
      var list = this.queryCssPath(path);
      var that = this;
      Array.prototype.forEach.call(list, function(element) {
        that._removeClassList(element);
        // add the new at last
        element.classList.add(selectedDom._CLASS_TAG);
      });
      return list;
    },
    /**
     * 给tag同类元素节点添加指定css path的 选中样式
     * @param path css path
     * @return matched elements
     */
    addSelectedTagSimDom: function(path) {
      this.cancelSimTagClass();
      var list = this.queryCssPath(path);
      Array.prototype.forEach.call(list, function(element) {
        // add the new at last
        element.classList.add(selectedDom._CLASS_TAGSIMELE);
      });
      return list;
    },
    /**
     *  给参数节点添加指定css path的 选中样式
     * @param path css path
     * @return matched elements
     */
    addSelectedParaDom: function(path) {
      var list = this.queryCssPath(path);
      var that = this;
      Array.prototype.forEach.call(list, function(element) {
        that._removeClassList(element);
        // add the new at last
        element.classList.add(selectedDom._CLASS_PARAM);
      });
      return list;
    },
    /**
     * 取消指定路径的Tag节点选中样式
     * 优先match classList，如果匹配不到，则从栈中清理最近一个
     * @param {*} path css path
     */
    cancelSelectedTagDom: function(path) {
      var list = this.queryCssPath(path);
      var that = this;
      Array.prototype.forEach.call(list, function(element) {
        if (element.classList.contains(selectedDom._CLASS_TAG)) {
          element.classList.remove(selectedDom._CLASS_TAG);
          that._restoreClassList(element);
        } else {
          that._cleanItemInClassList(element, selectedDom._CLASS_TAG);
        }
      });
      return list;
    },
    
     /**
     * 取消指定路径的param节点选中样式
     * @param {*} path css path
     */
    cancelSelectedParaDom: function(path) {
      var list = this.queryCssPath(path);
      var that = this;
      Array.prototype.forEach.call(list, function(element) {
        if (element.classList.contains(selectedDom._CLASS_PARAM)) {
          element.classList.remove(selectedDom._CLASS_PARAM);
          that._restoreClassList(element);
        } else {
          that._cleanItemInClassList(element, selectedDom._CLASS_PARAM);
        }
      });
      return list;
    },
    /**
     *  给同类元素参数节点范围添加指定css path的 选中样式
     * @param path css path
     * @return matched elements
     */
    addSimEleParaRange: function(path) {
        var list = this.queryCssPath(path);
        Array.prototype.forEach.call(list, function(element) {
          // add the new at last
          element.classList.add(selectedDom._CLASS_PARAMSIMELE);
        });
        return list;
      },
    /**
     * 取消所有的选中样式，并清理dvtClassListStack
     * 因为此输入为常量，故无须处理异常
     */
    cancelAllClass: function() {
      var list = document.querySelectorAll('.' + selectedDom._CLASS_TAG);
      Array.prototype.forEach.call(list, function(element) {
        element.classList.remove(selectedDom._CLASS_TAG);
        delete element.dvtClassListStack;
      });
      list = document.querySelectorAll('.' + selectedDom._CLASS_PARAM);
      Array.prototype.forEach.call(list, function(element) {
        element.classList.remove(selectedDom._CLASS_PARAM);
        delete element.dvtClassListStack;
      });
    },
    /**
     * 取消所有的同类选中样式
     * 因为此输入为常量，故无须处理异常
     */
    cancelSimTagClass: function() {
      var simList = document.querySelectorAll('.' + selectedDom._CLASS_TAGSIMELE);
      Array.prototype.forEach.call(simList, function(element) {
        element.classList.remove(selectedDom._CLASS_TAGSIMELE);
      });
    },
    /**
     * 取消所有的同类元素参数范围选中样式
     * 因为此输入为常量，故无须处理异常
     */
    cancelSimParaRangeClass: function() {
      var simRangeList = document.querySelectorAll('.' + selectedDom._CLASS_PARAMSIMELE);
      Array.prototype.forEach.call(simRangeList, function(element) {
        element.classList.remove(selectedDom._CLASS_PARAMSIMELE);
        // delete element.dvtClassListStack;
      });
    },

  };

  /**
   * 可视化DOM基类
   */
  function VisualDom() {
    // dom is the element along with the class specified by CLASS_TAG
    this.dom = function() {
      var div = document.createElement('div');
      div.setAttribute('class', this.CLASS_TAG);
      div.style.position = "absolute";
      return div;
    }();
  }
  /**
   *  define the class tag as a const
   */
  VisualDom.prototype.CLASS_TAG = 'dtm-init-tag-box';
  /**
   * show this dom element
   */
  VisualDom.prototype.show = function() {
      this.dom.style.display = "block";
  };
  /**
   * hide the dom element
   */
  VisualDom.prototype.hide = function() {
      this.dom.style.zIndex = "-1";
      this.dom.style.display = "none";
  };
  /**
   * clean the dom
   * @note avoid affecting body.scrollHeight when page switch in SPA
   */
  VisualDom.prototype.clean = function() {
    this.hide();
    this.dom.style.width = "";
    this.dom.style.height = "";
    this.dom.style.left = "";
    this.dom.style.top = "";
  };

  /**
   * 创建visualDom的派生对象，为了重写里面的show方法
   * @param {*} showFunc show方法
   */
  function buildVisualDom(showFunc) {
    var base = new VisualDom;
    var visualBlock =  Object.create(base);
    visualBlock._super = base;
    if (typeof showFunc === 'function') {
      visualBlock.show = showFunc;
    }
    return visualBlock;
  }

  /**
   * 基于VisualDom,创建遮罩层并override show
   */
  var maskLayer = buildVisualDom(function() {
      // call super show firstly
      this._super.show();
      this.dom.style.zIndex = "19891010";
      // init to cover whole document
      this.dom.style.width = getDocumentWidth() + "px";
      this.dom.style.height = getDocumentHeight() + "px";
      this.dom.style.left = "0";
      this.dom.style.top = "0";
    });

  /**
   * 基于VisualDom,创建选择框并override show / hide
   */
  var moveBlock = buildVisualDom(function() {
      // call super show firstly
      this._super.show();
      // SHOULD be less than maskLayer, otherwise moveBlock flicker
      this.dom.style.zIndex = "19891009";
      this.dom.style.boxShadow = "0px 0px 2px 2px red";
    });
  /**
   * override clean the moveBlock
   */
  moveBlock.clean = function() {
    this._super.clean();
    this.dom.style.boxShadow = "";
  };

  var simDomBLock = [];

  function createSimDomBlock(path) {
    simDomBlock.push(buildVisualDom(function() {
      // call super show firstly
      this._super.show();
      // SHOULD be less than maskLayer, otherwise moveBlock flicker
      this.dom.style.zIndex = "19891011";
      this.dom.style.boxShadow = "0px 0px 2px 2px dash";
    }));
  }
  /**
   * 可视化选择操作，单实例，包括：
   * 1. 串行化处理请求事件（来自portal message)
   * 2. 响应mouse事件以操作遮罩层和选择块的显示
   * 3. 响应click事件，并回应请求
   */
  var visualSelect = {
     // selected element by click
    _selectedElement: {},
    // object which is an abstract of requester
    _requestObj: dummyRequest,
    // state flag
    _selecting: false,
    /**
     * 开始选择，显示遮罩层与选择块
     *
     * @param requestObj the requester who trigger this visual select(如果传回调函数，this有问题)
     * @return true: begin successfully
     *         false: failed if has begun and not ended
     * @note  不支持并行，即如果进入选择状态，在没有endSelect前，不会处理新的beginSelect
     */
    beginSelect: function(requestObj) {
      if (this._selecting) {
        console.warn("[visual] is selecting, so bypass!");
        return false;
      }

      // show mask
      maskLayer.show();

      // monitor event on the mask layer and unnecessary to removeEventListener
      // note: the listener should be STATIC function instead of new instance like anonymous, bind, var xxx = function
      // see：https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#Memory_issues
      maskLayer.dom.addEventListener("mousemove", this._mouseMove, false);
      maskLayer.dom.addEventListener("mouseout", this._mouseOut, false);
      maskLayer.dom.addEventListener("click", this._clickHandler, false);

      // show moveBlock
      moveBlock.show();

      // keep requester for callback when clicked
      this._requestObj = requestObj || dummyRequest;
      this._selecting = true;
      return true;
    },

    /**
     * 结束选择, 隐藏遮罩层和选择块 并清理成员变量
     */
    endSelect: function() {
      moveBlock.clean();
      // clear all the members
      this._selectedElement = undefined;
      this._selecting = false;
      this._requestObj = dummyRequest;
    },

    /*
     * click handler which will notify caller if _callback is valid
     */
    _clickHandler: function() {
      var that = visualSelect;
      // 如果选择操作结束, 则忽略
      if (!that._selecting) {
        return;
      }

      // 如果未找到合适元素，不应该触发回调
      if (that._selectedElement === undefined) {
        return;
      }

      // 是否选中了已添加埋点的元素
      var selected = buildSelectedInfo(that._selectedElement);

      // callback the caller with the selected detail object
      if (typeof that._requestObj.selectedCallback === 'function') {
        that._requestObj.selectedCallback(selected);
      } else {
        dummyRequest.selectedCallback({});
      }
      // finish the selecting procedure
      visualSelect.endSelect();
    },

    /*
     * mouse move handler
     * @param {event} event mouse event object
     */
    _mouseMove: function(event) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      } else {
        window.event.returnValue = false;
        window.event.cancelBubble = true;
        return;
      };

      var that = visualSelect;
      // 如果选择操作结束, 则忽略
      if (!that._selecting) {
        return;
      }

      // hide maskLayer and moveBlock anyway
      maskLayer.hide();
      moveBlock.hide();
      // 返回当前鼠标所在位置的最顶层元素，也就是鼠标所在的页面元素
      var target = document.elementFromPoint(event.clientX, event.clientY);
      // show them again
      maskLayer.show();
      moveBlock.show();

      if (isWithinVisualDom(target)) {
          return;
      }

      // 是否符合过滤原则
      var result = typeof that._requestObj.matchPolicy === 'function'
                  ? that._requestObj.matchPolicy(target) : dummyRequest.matchPolicy(target);
      if (result) {
        // mark the move block and record the selected element
        that._setMovePosition(target, moveBlock.dom);
        that._selectedElement = target;
      } else {
        // else must clean, otherwise click trigger response with old selectedElement
        moveBlock.clean();
        visualSelect._selectedElement = undefined;
      }
    },

    /*
     *  鼠标移出遮罩隐藏moveBlock
     */
    _mouseOut: function() {
      // 如果选择操作结束, 则忽略
      if (!visualSelect._selecting) {
        return;
      }
      moveBlock.clean();
      // to avoid possible weird click event when mouse out
      visualSelect._selectedElement = undefined;
    },

    /**
     * adjust the range (ie.element's width of height)
     * to avoid element range over document range
     * @param {*} offset element offset to document
     * @param {*} range  element getBoundingClientRect
     * @param {*} documentRange  document range
     * @return  adjusted range within the document
     * @note only used by _setMovePosition
     */
    _trimRange: function(offset, range, documentRange) {
      var off = Math.max(offset, 0);
      var avail = Math.max(documentRange - off, 0);
      range = Math.min(range, avail);
      return range;
    },

    /**
     * 设置选择框（moveBlock）环绕被选择元素
     * @param {Dom Element} element 被选择的元素对象
     * @param {Dom Element} dom moveBlock的dom对象
     */
    _setMovePosition: function(element, dom) {
      var height = element.getBoundingClientRect().height;
      var elementOff = getOffset(element);
      var width = element.getBoundingClientRect().width;

      //fixme maybe useful, once over, height/width is zero
      height = this._trimRange(elementOff.top, height, getDocumentHeight());
      width = this._trimRange(elementOff.left, width, getDocumentWidth());

      // around the dom with style
      dom.style.left = elementOff.left + "px";
      dom.style.top = elementOff.top + "px";
      dom.style.width =  width + "px";
      dom.style.height = height + "px";
    }
  }; // end of VisualSelect

  /**
   *  default request instance
   *  abstract interface class likely
   */
  var dummyRequest = {
    /**
     * handle message
     * @param {*} event event from message.data
     */
    messageHandler: function(event) {},
    /**
     * visualSelect callback when user click a dom
     * @param {*} selected selected element detail information
     * @note refer to buildSelectedInfo() for selected
     */
    selectedCallback: function(selected) {
      console.warn('[visual] no selectedCallback?');
    },
    /**
     * selection policy which is provided by individual request
     * e.g addPara editPara may only select A tag
     * @param {*} selected selected element detail information
     * @return true: matched, or false
     */
    matchPolicy: function(selected) {
      return true;
    }
  };

  /**
   * to handle the addTag
   */
  var addTagRequest = {
    // keep the request code
    _event: void 0,

    messageHandler: function(event) {
      if (visualSelect.beginSelect(this)) {
        this._event = event;
      }
    },
    selectedCallback: function(selected) {
      // set the selected with tag dom css style
      selectedDom.cancelAllClass();
      selectedDom.addSelectedTagSimDom(selected.simEleCssPath);
      selectedDom.addSelectedTagDom(selected.path);
      // response to portal
      responseToPortal(this._event.status, {
        selected: selected
      });
    },
    matchPolicy: function(selected) {
      if (this._event.eleTypeRadio === 'btnOrLinkFlag') {
        // return true if selected is any button or link, when portal request btnOrLinkFlag
        if (isElementButton(selected)) {
          return true;
        }
        if (isElementLink(selected)) {
          return true;
        }
        return false;
      }
      return true;
    }
  }; // end of addTagRequest

  var addSimEleTagRequest = {
    messageHandler: function(event) {
        var rangeChanged = false;
        var oldRange = event.oldRange;
        var oldType = event.oldType;
        var isTagReselect = event.isTagReselect
        selectedDom.cancelSelectedTagDom(event.oldCssPath);
        var selected = {};
        var success;
        // try to set the new tag with selected css
        var tagList = selectedDom.addSelectedTagDom(event.cssPath);
        success = tagList.length > 0 ? true : false;
        selected.simEleCssPath = event.cssPath;
        selected.simEleParaRange = event.rangePath;
        selected.type = 1; // see buildSelectedInfo()
        // cancel the old tag dom css style
        // if same as cssPath, means cancel the added == add nothing
        selectedDom.cancelSimTagClass();
        if (
          (isTagReselect && !oldRange && selected.simEleParaRange) ||
          (oldRange && !selected.simEleParaRange) ||
          (oldRange && document.querySelectorAll(oldRange)[0] !== document.querySelectorAll(selected.simEleParaRange)[0])
          ) {
          rangeChanged = true;
        }
        // response portal with new selected
        responseToPortal(event.status, {
            selected: selected,
            success: success,
            rangeChanged: rangeChanged,
            oldRange: oldRange,
            oldType: oldType
        });
    }
  }; // end of addTagRequest


  /**
   * to handle add param
   */
  var addParamRequest = {
    _event: void 0,

    messageHandler: function(event) {
      if (visualSelect.beginSelect(this)) {
        this._event = event;
      }
    },
    selectedCallback: function(selected) {
      // set the selected with param dom css style
      selectedDom.addSelectedParaDom(selected.path);
      // response portal
      responseToPortal(this._event.status, {
        selected: selected,
        index:this._event.index
      });
    },
    matchPolicy: function(selected) {   
      return isElementPassword(selected);
    }
  }; // end of addParamRequest

  /**
   * to handle add param
   */
  var addSimEleParaRequest = {
    _event: void 0,

    messageHandler: function(event) {
      if (visualSelect.beginSelect(this)) {
        this._event = event;
      }
      selectedDom.addSimEleParaRange(event.simEleParaRange);
      // TODO: 显示同类元素参数范围圈选
    },
    selectedCallback: function(selected) {
      // set the selected with param dom css style
      var result = {};
      selectedDom.cancelSelectedParaDom(this._event.oldCssPath);
      if (selected.type !== -1) {
        result = querySimEleParaPath(selected.path, this._event.simEleParaRange);
        selectedDom.addSelectedParaDom(result.simElePath);
        selected.simEleParaRange = this._event.simEleParaRange;
        selected.simEleParaPath = result.simElePath;
        selected.type = 1;
      } else {
        selected.simEleParaRange = "";
        selected.simEleParaPath = "";
      }
      selectedDom.cancelSimParaRangeClass();

      // response portal
      responseToPortal(this._event.status, {
        selected: selected,
        index:this._event.index,
      });
    },
    matchPolicy: function(selected) {
      if (this._event.simEleParaRange) {
        // return true if selected is any button or link, when portal request btnOrLinkFlag
        if (!isOutOfSimEleRange(selected)) {
          return true;
        }
        return false;
      }
      return true;
    }
  }; // end of addParamRequest

  /**
   * to handle showEditTag
   * just show selected dom without re-selection
   */
  var showEditTagRequest = {
    messageHandler: function(event) {
      // if valid, enter edit tag mode, or bypass
      if (event.tagDetail) {
        var tagDetail = event.tagDetail;
        var tagList = (tagDetail && tagDetail.tagList);
        var paramList = (tagDetail && tagDetail.paramList);
        tagList = (tagList instanceof Array) ? tagList : [];
        paramList = (paramList instanceof Array) ? paramList : [];

        // mark the tag dom
        Array.prototype.forEach.call(tagList, function(item) {
          if (item) {
            var matched = selectedDom.addSelectedTagDom(item.cssPath);
            var element = document.querySelector(item.cssPath);
            if (matched.length > 0) {
              item.eleText = trimText.truncate(differTagName(matched[0]));
              !event.isAddTag && window.scrollTo(0, getElementTop(element)-200);
            } else {
              item.eleText = "";
            }
          }
        });

        // mark the params dom
        Array.prototype.forEach.call(paramList, function(item) {
          if (item) {
            var matched = selectedDom.addSelectedParaDom(item.cssPath);
            if (matched.length > 0) {
              item.eleText = trimText.truncate(differTagName(matched[0]));
            } else {
              item.eleText = "";
            }
          }
        });

        // response portal
        responseToPortal(event.status, {
          selected: {
            tagList: tagList,
            paramList: paramList
          }
        });
      }
    }
  }; // end of showEditTagRequest

  function getElementTop(elem){
  　　var elemTop=elem.offsetTop;//获得elem元素距相对定位的父元素的top

  　　elem=elem.offsetParent;//将elem换成起相对定位的父元素

  　　while(elem!=null){//只要还有相对定位的父元素 

  　　　　//获得父元素 距他父元素的top值,累加到结果中

  　　　　elemTop+=elem.offsetTop;

  　　　　//再次将elem换成他相对定位的父元素上;

  　　　　elem=elem.offsetParent;

  　　}

  　　return elemTop;

  }
  /**
   * to handle editTag
   */
  var editTagRequest = {
    _event: void 0,

    messageHandler: function(event) {
      if (visualSelect.beginSelect(this)) {
        this._event = event;
      }
    },
    selectedCallback: function(editSelected) {
      // 如果oldCssPath == selected.path，等同于没增减
      selectedDom.cancelSelectedTagDom(this._event.oldCssPath);
      // set the selected with tag dom css style
      selectedDom.addSelectedTagSimDom(editSelected.simEleCssPath);
      selectedDom.addSelectedTagDom(editSelected.path);

      // response portal with new selected
      responseToPortal(this._event.status, {
        selected: editSelected
      });
    },
    matchPolicy: function(editSelected) {
      if (this._event.eleTypeRadio === 'btnOrLinkFlag') {
        if (isElementButton(editSelected)) {
          return true;
        }
        if (isElementLink(editSelected)) {
          return true;
        }
        return false;
      }
      return true;
    }
  }; // end of editTagRequest

  /**
   * to handle editParam
   */
  var editParamRequest = {
    _event: void 0,

    messageHandler: function(event) {
      if (visualSelect.beginSelect(this)) {
        this._event = event;
      }
    },
    selectedCallback: function(editParaSelected) {
      // 如果oldCssPath == selected.path，等同于没增减
      selectedDom.cancelSelectedParaDom(this._event.oldCssPath);
      // set the selected with param css style
      selectedDom.addSelectedParaDom(editParaSelected.path);
      selectedDom.cancelSimParaRangeClass();
      // response portal
      responseToPortal(this._event.status, {
        selected: editParaSelected,
        index:this._event.index
      });
    },
    matchPolicy: function(editParaSelected) {   
      return isElementPassword(editParaSelected);
    }
  }; // end of editParamRequest

  /**
   * cancel all the block
   */
  var cancelRequest = {
    messageHandler: function(event) {
      // cancel all the tag param css style
      selectedDom.cancelAllClass();
      selectedDom.cancelSimTagClass();
      selectedDom.cancelSimParaRangeClass();
      // avoid something like "cancel" reached before "click"
      // cancel the possible selecting move block and mask layer
      visualSelect.endSelect();
      maskLayer.clean();
      // response with empty
      responseToPortal(event.status, {});
    }
  }; // end of cancelRequest

  /**
   * cancel selected moveBlock and maskLayer
   */
  var cancelSelectRequest = {
    messageHandler: function(event) {
      visualSelect.endSelect();
      responseToPortal(event.status, {});
    }
  }; // end of cancelSelectRequest

  /** 
   * cancel selected moveBlock and maskLayer
   */
  var cancelSelectSimEleRequest = {
    messageHandler: function(event) {
      var rangeChanged = false;
      var oldRange = event.oldRange;
      if (
        (!oldRange && event.rangePath) || 
        (oldRange && !event.rangePath) ||
        (oldRange && document.querySelectorAll(oldRange)[0] !== document.querySelectorAll(event.rangePath)[0])
        ) {
        rangeChanged = true;
      }
      selectedDom.cancelSimTagClass();
      visualSelect.endSelect();
      responseToPortal(event.status, {rangeChanged: rangeChanged});
    }
  }; // end of cancelSelectSimEleRequest

  var cancelSelectSimParaRangeRequest = {
    messageHandler: function(event) {
      selectedDom.cancelSimParaRangeClass();
      visualSelect.endSelect();
      responseToPortal(event.status, {});
    }
  }
  /**
   * cancel selected param block
   */
  var delParamRequest = {
    messageHandler: function(event) {
      selectedDom.cancelSimParaRangeClass();
      var matched = selectedDom.cancelSelectedParaDom(event.cssPath);
      var success;
      if (matched.length !== 1) {
        console.warn("[visual] delPara: matched number of cssPath is " + (matched && matched.length));
        success = false;
      } else {
        success = true;
      }

      responseToPortal(event.status, {
        success: success,
        index: event.index
      });
    }
  }; // end of delParamRequest

  /**
   * cancel selected param block with type 5
   */
  var delParamWithoutXpathRequest = {
    messageHandler: function(event) {
      selectedDom.cancelSimParaRangeClass();

      responseToPortal(event.status, {
        success: true
      });
    }
  }// end of delParamWithoutXpathRequest

  /**
   * handle match tag request when blur
   */
  var blurMatchTagRequest = {
    messageHandler: function(event) {
      var selected;
      var success;
      var isSimStatus;
      var isOutOfRange = false;
      // try to set the new tag with selected css
      var tagList = selectedDom.addSelectedTagDom(event.cssPath);
      if (tagList.length > 0) {
        isSimStatus = tagList.length === 1 ? false : true;
        selected = buildSelectedInfo(tagList[0]);
        var tagRangeNode = event.range.tagRangePath ? document.querySelector(event.range.tagRangePath) : "";
        var newRangeNode = selected.simEleParaRange ? document.querySelector(selected.simEleParaRange) : "";
        if (
          (tagRangeNode && newRangeNode && tagRangeNode !== newRangeNode) ||
          (tagRangeNode  && newRangeNode && !tagRangeNode.contains(newRangeNode))
        ) {
          success = false;
          isOutOfRange = true;
        } else if (tagList.length > 1) {
          selected.type = 1;
        }
        success = true;
      } else {
        selected = {};
        success = false;
      }
      // cancel the old tag dom css style
      // if same as cssPath, means cancel the added == add nothing
      selectedDom.cancelSelectedTagDom(event.oldCssPath);
      // response portal with new selected
      responseToPortal(event.status, {
        selected: selected,
        success: success,
        isSimStatus: isSimStatus,
        isOutOfRange: isOutOfRange
      });
    }
  }; // end of blurMatchTagRequest

  /**
   * to handle match parameter request when blur
   */
  var blurMatchParaRequest = {
    messageHandler: function(event) {
      var selected;
      var success;
      // try to set the new tag with selected css
      var paramList = selectedDom.addSelectedParaDom(event.cssPath);
      var paramListParent = paramList ? querySimEleParent(paramList) : undefined;
      var tagListParent = event.range.tagRangePath ? querySimEleParent(document.querySelectorAll(event.range.tagRangePath)) : undefined;
      var isOutOfRange = false;
      if (paramList.length > 0) {
        selected = buildSelectedInfo(paramList[0]);
        var tagRangeNode = event.range.tagRangePath ? document.querySelector(event.range.tagRangePath) : "";
        var paramXpathNode = event.range.xpath ? document.querySelector(event.range.xpath) : "";
        var paramType = event.paramType;

        if(
        (tagRangeNode && !tagRangeNode.contains(paramXpathNode) && paramType !== 5) ||
        (paramListParent && tagListParent && tagListParent !== paramListParent && paramType !== 5)
        ){
            success = false;
            isOutOfRange = true;
        } else if (paramList.length > 1) {
            selected.type = 1;
        }
        success = true;
      } else {
        selected = {};
        success = false;
      }
      selectedDom.cancelSelectedParaDom(event.oldCssPath);
      // response portal with new selected
      responseToPortal(event.status, {
        selected: selected,
        success: success,
        index: event.index,
        isOutOfRange: isOutOfRange
      });
    }
  }; // end of blurMatchParaRequest

 /**
  * to check if tag and param exist by cssPath
  */
  var checkExistRequest = {
    messageHandler: function(event) {
      var tagList = event.tagList;
      tagList = (tagList instanceof Array) ? tagList : [];
      var paramList = event.paramList;
      paramList = (paramList instanceof Array) ? paramList : [];

      // check tag list
      Array.prototype.forEach.call(tagList, function(item) {
        if (item) {
          var matchedList = selectedDom.queryCssPath(item.cssPath);
          if (matchedList.length > 0) {
            item.success = true;
            item.eleText = trimText.truncate(differTagName(matchedList[0]));
          } else {
            item.success = false;
            item.eleText = "";
          }
        }
      });
      //check param list
      Array.prototype.forEach.call(paramList, function(item) {
        if (item) {
          var matchedList = selectedDom.queryCssPath(item.cssPath);
          if (matchedList.length > 0) {
            item.success = true;
            item.eleText = trimText.truncate(matchedList[0].innerText);
          } else {
            item.success = false;
            item.eleText = "";
          }
        }
      });
      // response to portal
      responseToPortal(event.status, {
        selected: {tagList: tagList, paramList: paramList}
      });
    }
  }; // end of checkExistRequest

  /**
   * enable and show the masker Layer
   */
  var enableMaskLayer = {
    messageHandler: function(event) {
      maskLayer.show();
      responseToPortal(event.status, {});
    }
  };

  /**
   * disable and hide the masker Layer
   */
  var disableMaskLayer = {
    messageHandler: function(event) {
      maskLayer.clean();
      responseToPortal(event.status, {});
    }
  };

  /*
   * Entry for visual tag service
   */
  // setup for visual tag operation
  loadCssCode();

  var parentDom = document.querySelector("body");
  if (!parentDom) {
    return;
  }
  // body should not be static, otherwise visualDom display wrong.
  parentDom.style.position="relative";
  parentDom.appendChild(maskLayer.dom);
  parentDom.appendChild(moveBlock.dom);

  // map < msgCode, requestInst>
  var messageMap = {
    'addTag': addTagRequest,
    'cancel': cancelRequest,
    'showEditTag': showEditTagRequest,
    'addPara': addParamRequest,
    'editTag': editTagRequest,
    'editPara': editParamRequest,
    'cancelSelect': cancelSelectRequest,
    'delPara': delParamRequest,
    'delParaWithoutXpath': delParamWithoutXpathRequest,
    'blurMatchTag': blurMatchTagRequest,
    'blurMatchPara': blurMatchParaRequest,
    'checkExist': checkExistRequest,
    'enableMask': enableMaskLayer,
    'disableMask': disableMaskLayer,
    'cancelSelectSimEle':cancelSelectSimEleRequest,
    'addSimEleTag':addSimEleTagRequest,
    'cancelSelectSimParaRange':cancelSelectSimParaRangeRequest,
    'addSimElePara': addSimEleParaRequest,
  };
  
  // register message pipe
  window.addEventListener('message', function(event) {
      var data = event.data;
      // dispatch to the relative handler according to the event.data.status
      var request = messageMap[data.status];
      var handler = request && request.messageHandler;
      typeof handler === 'function' && request.messageHandler(data);
  }, false);

  // when load, heart beat firstly
  var heartBeat = function() {
    window.parent && window.parent.postMessage({
      'type': 'notify',
      'code': 'heartBeat',
      'options': {'url': window.location.href}
    }, "*");
  };
  heartBeat();
  // then start timer to heartbeat
  setInterval(heartBeat, 3000);

  // override the window.open to forbid webpage out of iframe
  window.open = function(url) {
    // force url to take effect in current window
    window.location.href = url;
  };
}();
