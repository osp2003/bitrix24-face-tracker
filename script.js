BX24.init(add_contact);
BX24.init(contact_list);
BX24.appOption.set('DESCRIPTOR_FIELD_ID', "UF_CRM_1682237232");
BX24.appOption.set('PORTAL', document.location.host);

 


// событие на кнопку "загрузить изображение с диска"
var imageLoader = document.getElementById('imageLoader');
imageLoader.addEventListener('change', handleImage)


var photo = document.getElementById('get_photo');
photo.addEventListener('click', handleClickPhotoButton)

var search_face = document.getElementById('search_face');
search_face.addEventListener('click', handleClickSearchButton)


var photo = document.getElementById('add_contact');
photo.addEventListener('click', handleClickAddContactButton)


let video = document.getElementById("video");
let canvas_video = document.getElementById("canvas_video");
let ctx_video = canvas_video.getContext("2d");


const VIDEOWIDTH = parseInt(document.getElementById('canvas_video').getAttribute('width'))
const VIDEOHEIGHT = parseInt(document.getElementById('canvas_video').getAttribute('height'))

const labeledDescriptors = [] // массив контактов с дескриторами (загрудается сразу при загрузке прложения)


// получить видеопоток с камеры
const accessCamera = () => {
  navigator.mediaDevices
    .getUserMedia({
      video: { width: VIDEOWIDTH, height: VIDEOHEIGHT },
      audio: false,
    })
    .then((stream) => {
      video.srcObject = stream;
    });
};

//выводить поток в канвас
accessCamera();
video.addEventListener("loadeddata", async () => {
  setInterval(detectFaces, 40);
});

// загрузить полученные из Б24 контакты в память, в массив labeledDescriptors
function push_data(descriptors_data){
  for (let i=0; i<descriptors_data.length; i++){
    if (descriptors_data[i][BX24.appOption.get('DESCRIPTOR_FIELD_ID')] != null) {
      descriptor_array = new Float32Array(descriptors_data[i][BX24.appOption.get('DESCRIPTOR_FIELD_ID')].split(','))
      if (descriptor_array.length == 128) {
        label = `${descriptors_data[i]["ID"]};${descriptors_data[i]["NAME"]};${descriptors_data[i]["LAST_NAME"]}`
        labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(label,[descriptor_array]))
        document.getElementById("contacts_count").innerText = labeledDescriptors.length
      }
    }
  }    
}

// получаем из б24 все контакты
function contact_list(){
  a = BX24.callMethod("crm.contact.list", 
    { 
      order: { "DATE_CREATE": "DESC" },
      select: [ "ID", "NAME", "LAST_NAME", BX24.appOption.get('DESCRIPTOR_FIELD_ID') ]
    },
    function(result) {

      if(result.error())
        console.error(result.error());
      else
        {
          push_data(result.data())
          if(result.more())
                result.next();
        }

		}	 
  );
}

// обработчик нажатия кнопки "найти контакт"
async function handleClickSearchButton(e){
  var canvas = document.getElementById('canvas_photo');
  source = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors()      
  const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors)


  if (source == null){
    M.toast({html: 'Не с чем сравнивать. Нет распознанных на изображении лиц', displayLength: 7000});
    return;
  }
  const bestMatch = faceMatcher.findBestMatch(source[0].descriptor)
    
  result = bestMatch.label.split(';')
  document.getElementById("href_to_contact").innerText = `${result[1]} ${result[2]}`
  document.getElementById("href_to_contact").href = `https://${BX24.appOption.get('PORTAL')}/crm/contact/details/${result[0]}/`
  document.getElementById("distance").innerText = `${bestMatch.distance}`

}

//------------------

// обработчик кнопки "сделать фото из видеопотока"
async function handleClickPhotoButton(e){
  document.getElementById("isFindFace").innerText = "---"
  var canvas = document.getElementById('canvas_photo');
  var ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, VIDEOWIDTH, VIDEOHEIGHT);
  //origin_base64_img = canvas.toDataURL();
 
            // этот блок нужен исключительно для визуалицации - показать что на загруженном фото лицо найдено
            faceDescriptions = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors()
            if (faceDescriptions.length == 1){
              M.toast({html: 'Лицо найдено !!!', displayLength: 7000})
              document.getElementById("isFindFace").innerText = "Да"
              //detectionsForSize = faceapi.resizeResults(faceDescriptions, { width: canvas.width, height: canvas.height })
              //faceapi.draw.drawDetections(canvas, detectionsForSize, { withScore: true })
            } 
            if (faceDescriptions.length == 0){
              document.getElementById("isFindFace").innerText = "Нет"
              M.toast({html: 'Лица на изображении не найдены', displayLength: 7000})
            }
  
}
//-----------------------


// функция Б24 - добавить контакт
function add_contact(fields_data){
  BX24.callMethod("crm.contact.add", {fields: fields_data, params: { "REGISTER_SONET_EVENT": "Y" }})
}

// обработчик кнопки "coздать контакт"
async function handleClickAddContactButton(e){
  var canvas = document.getElementById('canvas_photo');
  var ctx = canvas.getContext('2d');
  faceDescriptions = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors()    

  img_photo = document.getElementById('canvas_photo');
  const dataURL = img_photo.toDataURL();
  
  fields_data = {
    "NAME": document.getElementById("first_name").value,
    "LAST_NAME": document.getElementById("last_name").value,
    "PHOTO": {"fileData": ['photo.png', dataURL.replace(/^data:image\/(png|jpg);base64,/, "")] },
    "PHONE": [{ "VALUE": document.getElementById("phone").value, "VALUE_TYPE": "WORK" } ],
    //"UF_CRM_1682237232": faceDescriptions[0].descriptor.toString(),
  };
  fields_data[BX24.appOption.get('DESCRIPTOR_FIELD_ID')] = faceDescriptions[0].descriptor.toString()
  add_contact(fields_data);
}



// загрузить фото с компа
async function handleImage(e){
  document.getElementById("isFindFace").innerText = "---"
  var canvas = document.getElementById('canvas_photo');
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  //загружаем файл
    var reader = new FileReader();        
    reader.onload = function(event){
        var img = new Image();
        img.onload = async function(){
          var hRatio = canvas.width / img.width    ;
          var vRatio = canvas.height / img.height  ;
          var ratio  = Math.min ( hRatio, vRatio );
          ctx.drawImage(img, 0,0, img.width*ratio, img.height*ratio);
          //origin_base64_img = canvas.toDataURL();

          // этот блок нужен исключительно для визуалицации - показать что на загруженном фото лицо найдено
          faceDescriptions = await faceapi.detectAllFaces(canvas).withFaceLandmarks().withFaceDescriptors()
          if (faceDescriptions.length == 1){
            document.getElementById("isFindFace").innerText = "Да"
            M.toast({html: 'Лицо найдено', displayLength: 7000})

            //detectionsForSize = faceapi.resizeResults(faceDescriptions, { width: canvas.width, height: canvas.height })
            //faceapi.draw.drawDetections(canvas, detectionsForSize, { withScore: true })
          } 
          if (faceDescriptions.length == 0){
            document.getElementById("isFindFace").innerText = "Нет"
            M.toast({html: 'Лица на изображении не найдены', displayLength: 7000})
          }


        }
        img.src = event.target.result;

    };
    reader.readAsDataURL(e.target.files[0]);
}

// ГЛАВНЫЙ ЗАГРУЗОЧНЫЙ МОДУЛЬ

// !!!! нужен механизм одидания пока модели загрусятсяы

document.addEventListener('DOMContentLoaded', async function() {
  await faceapi.loadSsdMobilenetv1Model('https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights/ssd_mobilenetv1_model-weights_manifest.json')
  await faceapi.loadFaceLandmarkModel('https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights/face_landmark_68_model-weights_manifest.json')
  await faceapi.loadFaceRecognitionModel('https://cdn.jsdelivr.net/gh/cgarciagl/face-api.js@0.22.2/weights/face_recognition_model-weights_manifest.json')
}, false);




// отрисовка и обработка видеопотока
const detectFaces = async () => {
  ctx_video.drawImage(video, 0, 0, VIDEOWIDTH, VIDEOHEIGHT);
}




