
var Sass = function(){
	this.allStyles = '';
	this.globalCSS = '';
	this.StyleSet = [];
	this.globalVars = [];
	this.getStyleTags = function(){
		var tags = document.getElementsByTagName('style');
		//Copy all styleTag innerHTML to styles variable
		for (var i = 0,len=tags.length;i<len;i++){
			if(tags[i].type=='text/sass')
				this.allStyles += tags[i].innerHTML + '\n';
		}
		this.ConvertLines();
	};
	this.ConvertLines = function(){
		this.CodeBase = this.allStyles.match(/[^\n]*\n/gi);
		this.readCode();
	}
	this.readCode = function(){
		var ifStat = false;
		var ifStatTabCount = 0;
		var ifStatVal = true;
		for(var i = 0,len = this.CodeBase.length;i<len;i++){
			if(this.CodeBase[i]=='\n'){
				if(ifStat)
					ifStat = false;
				continue;
			} 
			
			var type = this.CodeBase[i].match(/:/)?'style':'selector';
			
			var tabs = this.CodeBase[i].replace(/([^\t])\t*/g,'$1').match(/\t/g);//
			var tabCount = tabs?tabs.length:0;
			this.CodeBase[i] = this.CodeBase[i].replace(/\n|\t/g,'');
			
			if(this.CodeBase[i].substr(0,1) == '!')
				type = 'var';
			else if(this.CodeBase[i].substr(0,1) == '@')
				type = 'instruction';
				
			if(ifStat && ifStatTabCount>=tabCount && type !='instruction')
				ifStat = false;
			if(ifStat && ifStatVal == true && type != 'instruction'){
				tabCount = ifStatTabCount;
			}
			if(ifStat && ifStatVal == true || (ifStat && ifStatVal == false && type =='instruction')  || !ifStat)			
			switch(type){
				case 'var':
					var tmpArr = this.CodeBase[i].replace(/ /,'').split('=');
					if(tmpArr.length==2);
					this.globalVars[tmpArr[0]] = tmpArr[1];
				break;
				case 'instruction':
					this.checkVars(i);
					if(this.CodeBase[i].indexOf('@if')>-1){
						ifStat = true;
						ifStatTabCount = tabCount;
						var ifStatVal = eval('('+this.CodeBase[i].substr(3)+')');
					}else if(this.CodeBase[i].indexOf('@else if')>-1){
						if(ifStatVal == false){
							ifStat = true;
							ifStatTabCount = tabCount;
							var ifStatVal = eval('('+this.CodeBase[i].substr(8)+')');
						}else ifStat = false;
					}else if(this.CodeBase[i].indexOf('@else')>-1){
						if(ifStatVal == false){
							ifStat = true;
							ifStatTabCount = tabCount;
							var ifStatVal = true;
						}else ifStat = false;
					}
				break;
				case 'selector':
					this.checkVars(i);
					if(tabCount==0){
						this.addStyleSet(this.CodeBase[i],0)
					}else{
						var parent = this.getParent(tabCount);
						var childId = this.addStyleSet(this.CodeBase[i],tabCount,parent);
						this.addChildToParent(childId,parent);
					}
				break;
				case 'style':
					this.checkVars(i);
					var parent = this.getParent(tabCount);
					this.addStyleToParent(this.CodeBase[i],parent);
				break;
			}
		}
		this.compileCSS();
	}
	this.compileCSS = function(){
		for(var i = 0,len = this.StyleSet.length;i<len;i++){
			if(this.StyleSet[i].tabCount)
				continue;
			this.compileSet(i);
		}
		for(var i = 0,len = this.StyleSet.length;i<len;i++){
			this.globalCSS += '\n' + this.StyleSet[i].pCode + '{' + this.StyleSet[i].cCode + '}';
		}
		
		this.addStyleTag(this.globalCSS);
		
		
	}
	this.compileSet = function(id){
		this.StyleSet[id].cCode = this.internalCSSStyles(id);
		var set = this.StyleSet[id];
		this.StyleSet[id].pCode = this.listParents(id);
		if(set.children.length){
			for(var i = 0,len = set.children.length;i<len;i++){
				this.compileSet(set.children[i]);
			}
		}
	}
	this.addStyleSet = function(selector,tabCount,parent){
		if(typeof(parent)==='undefined')parent = null;
		var id = this.StyleSet.length;
		this.StyleSet[id] = {
			selector:selector,
			parent:parent,
			children:[],
			styles:[],
			tabCount:tabCount
		}
		return id;
	}
	
	this.addChildToParent = function(childId,parent){
		this.StyleSet[parent].children[this.StyleSet[parent].children.length] = childId;
	}
	this.addStyleToParent = function(style,parent){
		this.StyleSet[parent].styles[this.StyleSet[parent].styles.length] = style;
	}
	this.getParent = function(tabCount){
		var j = this.StyleSet.length;
		var parent = false;
		do{
			j--;
			if(this.StyleSet[j].tabCount==tabCount-1)
				parent = j;
		}while(parent===false);
		return parent;
	}
	this.listParents = function(id){
		var currSet = this.StyleSet[id];
		var parList = currSet.selector;
		var pa = [];
		while(currSet.parent != null){
			currSet = this.StyleSet[currSet.parent];
			parList = currSet.selector + '|' + parList;
		}
		//creates parentlist  if there is multisets defined with comma creates additional lists
	
		var pArr = parList.split('|');
		for(var i = 0,len=pArr.length;i<len;i++){
			var split = pArr[i].split(',');
			if(split.length>1){
				if(pa.length){
					
					var tmpPA = [];
					for(var k = 0,l2 =pa.length;k<l2;k++){
						for(var j = 0,l3 =split.length;j<l3;j++){
							tmpPA[tmpPA.length] = pa[k] + ' ' + split[j];
						}
					}
					pa = tmpPA;
				}else{
					for(var j = 0,l2 =split.length;j<l2;j++){
						pa[pa.length] = split[j];
					}
				}
			}else{
				if(pa.length){
					for(var k = 0,l2 =pa.length;k<l2;k++){
						pa[k] += ' ' + pArr[i];
					}
				}else{
					pa[0] = pArr[i];
				}
			}
		}
		var parList = pa[0];
		for(var k = 1,l2 =pa.length;k<l2;k++){
			parList += ' , ' + pa[k];
		}
		return parList;
	}
	this.internalCSSStyles = function(id){
		var cCode = '';
		for(var i = 0,len = this.StyleSet[id].styles.length;i<len;i++){
			var style = this.StyleSet[id].styles[i];
			if(style.substr(0,1)==':')
				style = style.substr(1).replace(/\ /,': ');
				cCode += style + ';'
		}
		return cCode;
	}
	this.checkVars = function(id){
		this.CodeBase[id] = this.CodeBase[id].replace(/\![^ ]*/,this.returnVar);
		/*if(!m)
			return;
		for(var i = 0,len = m.length;i<len;i++){
			if()
		}*/
	}
	this.returnVar = function(varName){
		return this.globalVars[varName]
	}
	this.addStyleTag = function(styleData){
		hAppend = true;
		this.STYLETag = document.createElement('style');
		this.STYLETag.type = 'text/css';
		rules = document.createTextNode(styleData);
		if(this.STYLETag.styleSheet)
		this.STYLETag.styleSheet.cssText = rules.nodeValue;
		else this.STYLETag.appendChild(rules);
		document.getElementsByTagName("head")[0].appendChild(this.STYLETag);
	}
	this.getStyleTags();
}
Sass();