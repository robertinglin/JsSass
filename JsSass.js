
var Sass = function(){
	this.allStyles = '';
	this.globalCSS = '';
	this.StyleSet = [];
	this.globalVars = [];
	this.ParsedCodeBase = [];
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
		var ifStat = [];
		var ifStatTabCount = 0;
		var Loops = [];
		for(var i = 0,len = this.CodeBase.length;i<len;i++){
			if(this.CodeBase[i]=='\n'){
				if(ifStat.length)
					ifStat = [];
				continue;
			} 
			
			if(!this.ParsedCodeBase[i]){
				var type = this.CodeBase[i].match(/:/)?'style':'selector';
				
				var tabs = this.CodeBase[i].replace(/([^\t])\t*/g,'$1').match(/\t/g);
				var tabCount = tabs?tabs.length:0;
				this.ParsedCodeBase[i] = {code:this.CodeBase[i].replace(/\n|\t/g,''),tabCount:tabCount};
			}else type = this.ParsedCodeBase[i].type;
			var p = this.ParsedCodeBase[i];
			tabCount = p.tabCount;
			if(p.code.substr(0,1) == '!')
				type = 'var';
			else if(p.code.substr(0,1) == '@')
				type = 'instruction';
			p.type = type;
			
			if(p.type=='instruction'){//subtypes
				//if Sub-subtype
				if(p.code.indexOf('@if')>-1)
					p.subsubtype = 'if';
				else if(p.code.indexOf('@else if')>-1)
					p.subsubtype = 'elseif';
				else if(p.code.indexOf('@else')>-1)
					p.subsubtype = 'else';
				
				if(p.subsubtype)
					p.subtype = 'if';
				if(p.code.indexOf('@for')>-1 || p.code.indexOf('@while')>-1){
					p.subtype = 'loop';
					if(p.code.indexOf('through')>-1)
						p.subsubtype ='forthrough';
					else
						p.subsubtype ='for';
					if(p.code.indexOf('while')>-1)
						p.subsubtype ='while';
				}
				
			}
			if(Loops.length){
				if(tabCount<=Loops[Loops.length-1].tabCount){
					var l = Loops[Loops.length-1];
					this.setVar(l.variable,this.returnVar(l.variable)+1);
					if(this.returnVar(l.variable)<=l.end){
						i = l.codeStart;
						continue;
					}else{
						if(Loops.length>1)
						Loops.slice(0,-1);
						else Loops = [];
					}
				}
			}
			var ifPar = false;
			//Clean If Statements
			for(iS in ifStat){
				if(tabCount<=iS && (!p.subtype||p.subtype!='if'))
					ifStat[iS] = false;
				else if(tabCount>iS&&iS>ifPar&&ifStat[iS])
					ifPar = iS;
			}
			
			var ifCount = 0;
			for(iS in ifStat){
				if(ifStat[ifPar])
					ifCount++;
			}
			if(ifPar !== false && ifStat[ifPar].sbool && (!p.subtype||p.subtype!='if')){
				tabCount-=ifCount;
			}
			tabCount -= Loops.length;
			if(!ifCount || (ifPar !== false && ifStat[ifPar].sbool && !ifStat[ifPar].finished))
			switch(p.type){//type
				case 'var':
					var tmpArr = p.code.replace(/ /,'').split('=');
					if(tmpArr.length==2);
					this.setVar(tmpArr[0],tmpArr[1]);
				break;
				case 'instruction':
					
					if(p.subtype=='if'){
						this.checkVars(i);
						switch(p.subsubtype){
							case 'if':
								ifStat[tabCount] = {
									tabCount:tabCount,
									sbool: eval('('+p.varcode.substr(3)+')')
								}
							break;
							case 'elseif':
								if(ifStat[tabCount].sbool==false)
									ifStat[tabCount].sbool = eval('('+p.varcode.substr(8)+')')
								else ifStat[tabCount].finished = true;
							break;
							case 'else':
								if(ifStat[tabCount].sbool==false)
									ifStat[tabCount].sbool = true;
								else ifStat[tabCount].finished = true;
							break;
						}
					}
					if(p.subtype=='loop'){
						switch(p.subsubtype){
							case 'for':case 'forthrough':
								var lid = Loops.length;
								Loops[lid] = {
									type:'for',
									codeStart:i,
									tabCount:tabCount,
									variable:p.code.replace(/@for (.*) from.*/,'$1'),
									start:p.code.replace(/.*from (.*) (through|to).*/,'$1'),
									end:p.code.replace(/.*(through|to)(.*)/,'$2'),
									complete:false
								}
								if(p.subsubtype=='for'){
									Loops[lid].end--;
								}
								this.globalVars[Loops[lid].variable] = Loops[lid].start*1;
						}
					}
				break;
				case 'selector':
					this.checkVars(i);
					if(tabCount==0){
						this.addStyleSet(p.varcode,0)
					}else{
						var parent = this.getParent(tabCount);
						var childId = this.addStyleSet(p.varcode,tabCount,parent);
						this.addChildToParent(childId,parent);
					}
				break;
				case 'style':
					this.checkVars(i);
					var parent = this.getParent(tabCount);
					this.addStyleToParent(p.varcode,parent);
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
		this.ParsedCodeBase[id].varcode = this.ParsedCodeBase[id].code.replace('!=','^%#').replace(/(\#\{)?\![^ ]*/g,this.returnVar).replace('^%#','!=');
	}
	this.returnVar = function(varName){
		varName = varName.replace(/\#\{([^\}]*)}/,'$1')		
		return this.globalVars[varName]
	}
	this.setVar = function(varName,val){
		if(val.match){
			var color = false
			if(val.match(/\#[0-9a-f][0-9a-f][0-9a-f]([0-9a-f][0-9a-f][0-9a-f])?/gi)){
					//val = val.replace(/\#[0-9a-f][0-9a-f][0-9a-f]([0-9a-f][0-9a-f][0-9a-f])?/gi,this.hexToNum)
					color = true
			}
			if(val.match(/(\-|\+|\*|\/)/)){
				if(!color)
				val = eval(val);
			}
		}
		
		this.globalVars[varName] = val;
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