jQuery(function($){

    var rules;
    /* getJson() a pour objet de charger des données encodées en JSON en utilisant la méthode GET. Elle est ici utilisée pour récupérer les règles définies dans "rules.json". */
    $.getJSON("rules.json", function(data){
        rules = data;
    }).fail(function(){
        console.log("An error has occurred while getting rules.json.");
    });
    
    var cities;
    var cities_dict;
    /* Récupération de la liste des villes disponibles et de leurs identifiants. */
    $.getJSON("city.list_fr.json", function(data){
        cities = data;
	cities_dict = Object.keys(cities);
	//création de l'objet grâce auquel sera réalisé la fuzzy search.
	fs = FuzzySet(cities_dict);
    }).fail(function(){
        console.log("An error has occurred while getting city.list_fr.json.");
    });
    
    /* Fonction plaçant la barre de défilement en bas d'un des éléments HTML d'une classe donnée en argument. Arguments : chaîne correspondant à un élément HTML, rang de l'élément parmi cette classe.*/
    function downScrollClass(html_class, rk){
	elt = $("."+html_class).eq(rk);
	var hght = elt.prop("scrollHeight");
	elt.scrollTop(hght);
    };
    
    /* Fonction permettant l'affichage des messages. Arguments : message, origine du message ("user" / "bot"). */
    function display_comments(msg, origin){
	elt = $('.chatbot_exchange').eq(0);
	if(msg && origin === "user"){
	    $(elt).append("<div class=\"chatbot_block right_block\"><p class=\"chatbot_msg right_msg\">" + msg + "</p></div>"); //les " entourant les attributs sont échappés afin qu'ils soient pris en compte
	}
	if(msg && origin === "bot"){
	    $(elt).append("<div class=\"chatbot_block\"><p class=\"chatbot_msg\">" + msg + "</p></div>");
	}
	downScrollClass("chatbot_exchange", 0);
    };

    /* Gestionnaire de l'évnènement "click" lié au bouton d'envoi des messages. */ 
    $('#send_msg_btn').click(function(){
	//récupération des données entrées par l'utilisateur
	var msg_txt = $('#user_msg_txt').val();
	//affichage du message
	display_comments(msg_txt, "user");
	$('#user_msg_txt').val('');
	//appel de la fonction générant les réponses du bot
	getBotResponse(msg_txt);
    });

    /* Gestionnaire de l'événement de pression d'un bouton lié au formulaire d'envoi des messages. */
    $('#user_msg_txt').on("keypress", function(e){
	//keyCode indique le bouton du clavier qui a été pressé (13 correspond à la touche "Enter").
	if(e.keyCode === 13){
	    //preventDefault() permet de désactiver le comportement par défaut de l'événement (en l'occurrence, que l'appui sur la touche entrée provoque un retour à la ligne).
	    e.preventDefault();
	    //le champ est désactivé pour éviter plusieurs soumissions
	    $(this).attr("disabled", "disabled");
	    //simule un clic sur le bouton "Envoyer"
	    $('#send_msg_btn').click();
	    //le champ est réactivé
            $(this).removeAttr("disabled");
	}
    });

    /* Fonction dont l'objet est de déterminer si une phrase correspond à un ou plusieurs motifs des expressions régulières présentes dans rules[] et à retourner un tableau comprenant le nombre d'expressions capturées par la regex, le nom de l'action à effectuer par le chatbot et, le cas échéant, les expressions capturées. Si plusieurs expressions correspondent à la phrase donnée en argument, celle dont le "rank" est le plus élevé est retournée. Arguments : chaîne de caractères. */  
    function findRule(txt){
	var res = [];
	for(var i = 0; i < rules.length; i++){
	    reg = new RegExp(rules[i]["regex"], 'i');
	    regRes = reg.exec(txt);
	    if(regRes){
		if(rules[i]["action"][0]){
		    //deep copy de l'objet initial pour pouvoir y inclure les expressions capturées
		    var ruleArg = $.extend(true,{},rules[i]);
		    for(var j = 1; j <= rules[i]["action"][0]; j++){
			ruleArg["action"].push(regRes[j]);
		    }
		    res.push(ruleArg);
		}
		else{
		    res.push(rules[i]);
		}
	    }
	}
	if(res.length > 1){
	    //https://stackoverflow.com/questions/4020796/finding-the-max-value-of-an-attribute-in-an-array-of-objects
	    highestRankRule = res.reduce((high, curr) => high.rank < curr.rank ? high : curr);
	    return highestRankRule.action;
	}
	else if(res.length == 1){
	    return res[0].action;
	}
	return false;
    };

    /* Fonction destinée à produire la réponse du bot. Elle exécute la fonction correspondant à l'action retournée par findrule(). Si aucune action n'est retournée par findrule() une réponse par défaut est selectionnée au hasard. Pour exécuter la fonction correspondant à l'action retournée par findrule() sous forme de chaîne de caractères, l'objet "window" est utilisé. Celui-ci référence les objets de la fenêtre du navigateur, dont les fonctions. La référence à la fonction est récupérée dans une variable puis exécutée. (https://www.geeksforgeeks.org/how-to-call-function-from-it-name-stored-in-a-string-using-javascript/). Cette technique est une alternative à l'utilisation de la fonction "eval()", qui est déconseillée (https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/eval). Argument : chaîne de caractères. */
    function getBotResponse(txt){
	var rule = [];
	var fn;
	if(rule = findRule(txt)){
	    var func_to_exec = rule[1] + "_func";
	    if(rule[0]){
		fn = window[func_to_exec](rule);
	    }
	    else{
		fn = window[func_to_exec];
	    }	
	    if(typeof fn == "function") fn();
	}
	else{
	    var defaultResponse = ["J'ai du mal à comprendre...", "Dites m'en plus moussaillon !", "Comment ?", "Il y a trop de vent, je ne comprends pas !"];
	    var response = defaultResponse[Math.floor(Math.random()*defaultResponse.length)];
	    display_comments(response, "bot");
	}
    };

    /* Fonction permettant l'envoi d'une requête à l'API REST de openweathermap.org. En cas de succès, les données du jour sont affichées. Argument : id de la ville dont on cherche à connaître la météo (disponible dans cities{}). */ 
    function sendRequests(city){
	$.ajax({
	    url: 'https://api.openweathermap.org/data/2.5/forecast',
	    data: {
		appid: '3f4dd9fef911c1780d559479516052ab',
		id: city,
		units: "metric",
		lang: "fr"
	    },
	    dataType: 'json',
	    error: function(jqXHR, textStatus, errorThrown){
		var response = "Je suis désolé moussaillon, j'ai rencontré une erreur en envoyant la requête au serveur. Si ça vous intéresse, voici les détails : " + textStatus + ". Erreur HTTP : " + errorThrown + ".";
		display_comments(response, "bot");
	    },
	    success: function(apiResponse){
		if(apiResponse.cod !== "200"){
		    var response = "Je suis désolé moussaillon, je n'ai pas pu obtenir de réponse à votre question" + " (" + apiResponse.cod + ").";
    		    display_comments(response, "bot");
    		}
    		else{
    		    var response = "Voici la météo à " + apiResponse.city.name + " :<br/>" + "Température : " + apiResponse.list[0].main.temp + " degrés C.<br/>Temps : " + apiResponse.list[0].weather[0].description + ".<br/><img id=\"weather_icon\" src=\"http://openweathermap.org/img/w/" + apiResponse.list[0].weather[0].icon + ".png\" alt=\"Icone météo\">";
		    display_comments(response, "bot");
		}
	    }
	});
    };

    /*** Fonctions correspondant aux actions executées par le bot. Elles sont ajoutées en propriétés de l'objet window (v. "getBotResponse()"). ***/
    window.bonjour_func = function bonjour_func(){
	var response = "Bonjour mousaillon ! En quoi puis-je vous aider ?";
	display_comments(response, "bot");
     };

    window.commentVa_func = function commentVa_func(){
	var response = "Je vais bien, merci.";
	display_comments(response, "bot");
    };

    window.bonjourCommentVa_func = function bonjourCommentVa_func(){
	var response = "Bonjour mousaillon ! Je vais bien, merci. En quoi puis-je vous aider ?";
	display_comments(response, "bot");
    };

    window.aurevoir_func = function aurevoir_func(){
	var response = "Au revoir, et bon vent !";
	display_comments(response, "bot");
    };

    window.remerciements_func = function remerciements_func(){
	var response = "Merci à vous moussaillon.";
	display_comments(response, "bot");
    };
    
    window.aide_func = function aide_func(){
	var response = "Je suis Matéo, votre Capitaine. Je donne la météo du jour. Donnez moi le nom d'une ville française, je vous répondrai.<br/>Je suis toujours prompt à animer une discussion ou amorcer un débat.<br/>Pour info, mes données météo viennent d'openweathermap.org.";
	display_comments(response, "bot");
    };

    window.date_func = function date_func(){
	var dateResponses = ["Je ne suis ni devin, ni historien, les dates m'horripilent : profitons plutôt de l'instant présent.", "Namaste : concentrons-nous sur le présent.", "Je suis Captain Matéo, pas Madame Irma&nbsp;!"];
	var response = dateResponses[Math.floor(Math.random()*dateResponses.length)];;
	display_comments(response, "bot");
    };

    /* Fonction déterminant si la ville entrée par l'utilisateur est disponible. En l'absence de concordance exacte, une "fuzzy search" est réalisée, permettant de proposer des villes dont l'orthographe est proche de celle entrée par l'utilisateur. Argument : tableau retourné par "findrule()". */
    window.ville_func = function ville_func(rule){
	if(rule[2].toLowerCase() in cities){
	    var id = String(cities[rule[2].toLowerCase()]);
	    sendRequests(id);
	}
	else{
	    // fuzzy search
	    var fuzzy = fs.get(rule[2]);
	    // filtre permettant de ne conserver que les villes dont le score de concordance dépasse 0.70
	    fuzzy = fuzzy.filter(elt => elt[0] > 0.70);
	    if(fuzzy.length > 0){
		var response = "Vouliez-vous dire :<br/>";
		for(i = 0; i < fuzzy.length; i++){
		    if(fuzzy[i][0] > 0.70){
			response += "<span class=\"cities_proposal\">" + fuzzy[i][1].charAt(0).toUpperCase() + fuzzy[i][1].slice(1) + "</span>,<br/>";
		    }
		}
		response = response.slice(0,-6) + " ?";
	    }
	    else{
		response = "Désolé, je ne connais pas cette ville.";
	    }
	    display_comments(response, "bot");
	}	
    };

    /* Evenement sur les propositions de villes émises suite à la "fuzzy search". L'événement est attaché à un élément présent dès le chargement de la page. L'élément ajouté de manière dynamique est donné en argument de la méthode ".on()" ("delegated event-handler" : https://api.jquery.com/on/ ). */
    $('.chatbot_exchange').on('click', '.cities_proposal', function(){
	var city = $(this).text();
	var id = String(cities[city.toLowerCase()]);
	sendRequests(id);
    });

    /* Affichage du message d'accueil. */
    var welcome_msg = "Je suis à votre écoute. Demandez-moi de l'aide si vous voulez mieux me connaître.";
    display_comments(welcome_msg, "bot");
    
});
