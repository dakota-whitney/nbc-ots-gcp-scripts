const doGet = e => {

  Logger.log("GET received: %s", e);
  
  let platform, id;

  try{
    
    if(e.parameter.iosId){

      platform = "ios";

      id = e.parameter.iosId;

    }
  
    else if(e.parameter.googleId){

      platform = "google";

      id = e.parameter.googleId;

    }

    else if(e.parameter.tvosId){

      platform = "tvos";

      id = e.parameter.tvosId;

    }

    else if(e.parameter.rokuId){

      platform = "roku";

      id = e.parameter.rokuId;

    }
  
    else throw new Error("Invalid ID");

    const templateId = PropertiesService.getScriptProperties().getProperty(`${platform}TemplateId`);

    const user = decodeURIComponent(e.parameter.user);

    const permission = DriveApp.getFileById(templateId).getAccess(user);
    if(permission === DriveApp.Access.NONE) throw new Error("Access Denied");

    const template = SpreadsheetApp.openById(templateId).getSheets();

    const marketSheet = template.find(sheet => sheet.getRange(platform.match(/ios/) ? "A2" : "A3").getValue().includes(id));

    let changes = marketSheet.getDataRange().getValues()
      .filter(row => row.includes("Updated"))
      .map(row => row.filter((cell,i) => i === 0 || i === 1));

    changes = Object.fromEntries(changes);

    changes.appUrls = template.filter(sheet => sheet.getName().match(/NBC|Telemundo|necn/)).map(sheet => {
      return {
        market: sheet.getName(),
        url: sheet.getRange(platform.match(/ios/) ? "A2" : "A3").getValue()
      };
    });

    Logger.log("changes: %s", changes);

    return ContentService.createTextOutput(JSON.stringify(changes)).setMimeType(ContentService.MimeType.JSON);
  }
  catch(e) {
    Logger.log(e.message);
    throw new Error(e.message);
  };
};