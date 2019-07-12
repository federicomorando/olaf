// Queries
let authorSelect = () => {
    return `PREFIX bf2: <http://id.loc.gov/ontologies/bibframe/>
            PREFIX schema: <http://schema.org/>
            PREFIX dcterm: <http://purl.org/dc/terms/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX owl: <http://www.w3.org/2002/07/owl#>
            PREFIX bookType: <http://dati.cobis.to.it/vocabulary/bookType/>
            PREFIX olaf: <http://olaf.synapta.io/onto/>

            SELECT ?personURI ?personName (SAMPLE(?description) as ?description) (SAMPLE(?link) as ?link) (GROUP_CONCAT(DISTINCT(?personRole); separator="###") as ?personRole) (GROUP_CONCAT(distinct(?title); separator="###") as ?title) WHERE {

                {
                    SELECT ?personURI (COUNT(DISTINCT ?contribution) as ?titlesCount) WHERE {

                        ?contribution bf2:agent ?personURI .
                        MINUS {?personURI owl:sameAs ?wd}
                        MINUS {?personURI cobis:hasViafURL ?vf}
                        MINUS {?personURI olaf:skipped ?skipped}
                        FILTER(ISURI(?personURI))

                    } GROUP BY ?personURI
                      ORDER BY DESC(?titlesCount)
                      LIMIT 1
                      OFFSET ${Math.floor(Math.random() * 49)}
                }

                ?instance bf2:instanceOf ?work .
                ?work bf2:contribution ?contribution .
                ?contribution bf2:agent ?personURI .

                ?instance bf2:title ?titleURI .
                ?titleURI rdfs:label ?title .

                OPTIONAL {?personURI schema:description ?description . }
                OPTIONAL { ?personURI foaf:isPrimaryTopicOf ?link . }

                OPTIONAL { ?personURI schema:name ?personName . }
                OPTIONAL { ?contribution bf2:role/rdfs:label ?personRole . }
                MINUS {?personURI owl:sameAs ?wd}
                MINUS {?personURI cobis:hasViafURL ?vf}
                MINUS {?personURI olaf:skipped ?skipped}

            } GROUP BY ?personURI ?personName`;
};

let cobisInsertWikidata = (authorUri, optionWikidata) => {
    return `INSERT INTO GRAPH<http://dati.cobis.to.it/OLAF/>{
                <${authorUri}> owl:sameAs <${optionWikidata}>
            }`;
};

let cobisInsertViaf = (authorUri, optionViaf) => {
    return `PREFIX cobis: <http://dati.cobis.to.it/vocab/>
            INSERT INTO GRAPH<http://dati.cobis.to.it/OLAF/>{
                <${authorUri}> cobis:hasViafURL "${optionViaf}"
            }`;
};

let cobisInsertSbn = (authorUri, optionSbn) => {
    return `PREFIX cobis: <http://dati.cobis.to.it/vocab/>
            INSERT INTO GRAPH<http://dati.cobis.to.it/OLAF/>{
                <${authorUri}> cobis:hasSbn "${optionSbn}"
            }`;
};

let cobisInsertSkip = (authorUri) => {
    return `PREFIX olaf: <http://olaf.synapta.io/onto/>
            INSERT INTO GRAPH<http://dati.cobis.to.it/OLAF/>{
                <${authorUri}> olaf:skipped ?now
            }
            WHERE {
                BIND(NOW() as ?now)
            }`;
};

let wikidataQuery = (name, surname) => {
    return `
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>
        PREFIX wd: <http://www.wikidata.org/entity/>
        SELECT (?item as ?wikidata) (SAMPLE (?nome) as ?nome) (GROUP_CONCAT(?tipologia) as ?tipologia) (SAMPLE (?num) as ?num) (SAMPLE (?descrizione) as ?descrizione) (SAMPLE (?altLabel) as ?altLabel)  (SAMPLE (?birthDate) as ?birthDate) (SAMPLE (?deathDate) as ?deathDate) (SAMPLE (?immagine) as ?immagine) (SAMPLE (?itwikipedia) as ?itwikipedia) (SAMPLE (?enwikipedia) as ?enwikipedia)  (SAMPLE (?viafurl) as ?viafurl)
        (SAMPLE (?treccani) as ?treccani)  (SAMPLE (?sbn) as ?sbn)
        WHERE {

            SERVICE wikibase:label {
                bd:serviceParam wikibase:language "it".
                ?item rdfs:label ?nome .
                ?type rdfs:label ?tipologia.
                ?item skos:altLabel ?altLabel .
                ?item schema:description ?descrizione
            }

            SERVICE wikibase:mwapi {
                bd:serviceParam wikibase:api "EntitySearch" .
                bd:serviceParam wikibase:endpoint "www.wikidata.org" .
                bd:serviceParam mwapi:search "${name + " " + surname}" .
                bd:serviceParam mwapi:language "it" .
                ?item wikibase:apiOutputItem mwapi:item .
                ?num wikibase:apiOrdinal true .
            }

            OPTIONAL {
                ?item wdt:P569 ?birthDate .
            }

            OPTIONAL {
                ?item wdt:P570 ?deathDate .
            }

            OPTIONAL {
                ?item wdt:P18 ?immagine .
            }

            OPTIONAL {
                ?item wdt:P3365 ?treccani .
            }

            OPTIONAL {
                ?itwikipedia schema:about ?item .
                FILTER(CONTAINS(STR(?itwikipedia), 'it.wikipedia.org'))
            }

            OPTIONAL {
                ?enwikipedia schema:about ?item .
                FILTER(CONTAINS(STR(?enwikipedia), 'en.wikipedia.org'))
            }

            OPTIONAL {
                ?item wdt:P214 ?viaf
                BIND(concat('https://viaf.org/viaf/', ?viaf) as ?viafurl)
            }

            OPTIONAL {
                ?item wdt:P396 ?sbn_raw
                BIND(REPLACE(STR(?sbn_raw), "\\\\\\\\", "_") as ?sbn)
            }

            MINUS{
                ?item wdt:P31 wd:Q15632617
            }

            MINUS{
                ?item wdt:P31 wd:Q4167410
            }

            MINUS{
                ?item wdt:P31 ?class.
                ?class wdt:P279* wd:Q234460
                VALUES ?class {wd:Q838948 wd:Q14204246}
            }

            ?item wdt:P31 ?type .

        }
        GROUP BY ?item
        ORDER BY ASC(?num) LIMIT 20`
};

// Wikidata queries utils
/*let handleWikidataBody = (body) => {

    // Initialize response
    let wikidataResult = [];

    // Count bindings
    let count = 0;

    body.results.bindings.forEach((binding) => {

        // Generate object
        wikidataResult[count] = {};

        // Populate wikidataResult
        Object.keys(binding).forEach((key) => {
            // Get dates
            if (key === "birthDate" || key === "deathDate")
                wikidataResult[count][key] = binding[key].value.substr(0, 10);
            // Get image
            else if (key === "immagine")
                wikidataResult[count][key] = binding[key].value.substr(5, binding[key].value.length);
            // Other stuff
            else
                wikidataResult[count][key] = binding[key].value
        });

        wikidataResult[count].item = JSON.stringify(wikidataResult[count]);

        // Increment counter
        count++;

    });

    return wikidataResult;

};


let handleVIAFBody = (body, viafurls) => {

    // Initialize response
    let VIAFresult = [];

    if (body.result === null)
        return VIAFresult;

    let parsedcode = [];

    body.result.forEach((d) => {
        // Populate result
        if (['uniformtitleexpression', 'uniformtitlework'].indexOf(d.nametype) < 0 && viafurls.indexOf('https://viaf.org/viaf/' + d.viafid) === -1 && parsedcode.indexOf(d.viafid) === -1 ) {
            parsedcode.push(d.viafid);

            let item = {};

            item.nome = d.term;
            item.viafurl = 'https://viaf.org/viaf/' + d.viafid;
            item.tipologia = d.nametype;
            if (d.hasOwnProperty('iccu'))
                item.sbn = "IT_ICCU_" + d.iccu.substring(0, 4).toUpperCase() + "_" + d.iccu.substring(4, 10);

            item.item = JSON.stringify(item);

            VIAFresult.push(item)
        }
    });

    return VIAFresult;

};*/

// Functions
function authorOptions(name, surname){

    // Compose queries
    return [composeQueryWikidata(name, surname), composeQueryVIAF(name, surname)];

}

function authorLink(body) {

    // Get body params
    let authorUri = body.authorUri;
    let optionWikidata = body.optionWikidata;
    let optionViaf = body.optionViaf;
    let optionSbn = body.optionSbn;

    // Queries params and requests
    let links = {'wikidata': optionWikidata, 'viaf': optionViaf, 'sbn': optionSbn};
    console.log(links);
    let requests = [];

    // Generate requests
    Object.keys(links).forEach((key) => {

        // Parse query
        if(links[key] !== undefined) {
            if (key === 'wikidata')
                requests.push(composeQuery(cobisInsertWikidata(authorUri, optionWikidata)));
            else if (key === 'viaf')
                requests.push(composeQuery(cobisInsertViaf(authorUri, optionViaf)));
            else if (key === 'sbn' && !optionWikidata.includes('IT_ICCU'))
                requests.push(composeQuery(cobisInsertSbn(authorUri, optionViaf)));
        }

    });

    return requests;

}

function authorSkip(body) {

    // Get body params
    let authorUri = body.authorUri;
    // Return query
    return cobisInsertSkip(authorUri);

}

// Query composer
function composeQuery(query) {

    // Query parameters
    let queryUrl = 'https://dati.cobis.to.it/sparql?default-graph-uri=&query=';
    let queryFormat = '&format=json';

    return queryUrl + encodeURIComponent(query) + queryFormat;

}

function composeQueryWikidata(name, surname){

    // Compose query
    return {
        method: 'GET',
        url: 'https://query.wikidata.org/sparql',
        qs: {
            query: wikidataQuery(name, surname)
        },
        headers: {
            'cache-control': 'no-cache',
            Host: 'query.wikidata.org',
            'Accept-Language': 'it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3',
            Accept: 'application/sparql-results+json',
            'user-agent': 'olaf',
        }
    }

}

function composeQueryVIAF(name, surname){

    // Compose query
    return {
        method: 'GET',
        url: 'https://www.viaf.org/viaf/AutoSuggest',
        qs: {
            query: name + " " + surname
        },
        headers: {
            'cache-control': 'no-cache',
            'Accept-Language': 'it-IT,it;q=0.8,en-US;q=0.5,en;q=0.3',
            'user-agent': 'olaf',
        }
    }

}

// Exports
exports.authorSelect = () => {
    return composeQuery(authorSelect());
};

exports.authorOptions = (name, surname) => {
    return authorOptions(name, surname);
};

exports.authorSkip = (body) => {
    return authorSkip(body);
}

exports.authorLink = (body) => {
    return authorLink(body)
};