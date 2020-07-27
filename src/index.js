const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const nodemailer = require('nodemailer')
const mysql = require("mysql")
const util = require('util')
const multer = require('multer')

const app = express()
app.use(cors())
app.use(bodyParser.json())

const upload = multer() 

const db = mysql.createConnection({
    host: "45.77.194.113",
    port: '3306',
    user: "appshopi_app",
    password: "3zWVHGFpvWU~",
    database: "appshopi_app"
    // host: "localhost",
    // user: "root",
    // password: "",
    // database: "appshopi_app"
})
const query = util.promisify(db.query).bind(db);
db.connect(function(err){
    if(err){
    console.log('Error connecting to Db' + err)
    return
    }
    console.log('Connection established')
})

app.use('/', (req, res, next) => {
    console.log('a')
    next()
})

app.get('/store/:shopURL' ,async (req, res) =>{
    const {shopURL} = req.params
    try{
        const storeData = await query(`
            SELECT lojas.id, lojas.nome, lojas.favicon, estilos.cor
            FROM lojas
            INNER JOIN estilos
            ON estilos.id = lojas.id_estilos
            WHERE site LIKE '%${shopURL}%'`)
        res.status(200).send(JSON.stringify(storeData[0]))
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/header/:shopURL', async (req, res) => {
    const {shopURL} = req.params
    try{
        const storeData = await query(`SELECT * FROM lojas WHERE site LIKE '%${shopURL}%'`)
        res.status(200).send(storeData[0])
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/banners/:shopURL', async (req, res) => {
    const {shopURL} = req.params
    try{
        const bannersData = await query(`SELECT banners.id, banners.link, banners.imagem FROM banners LEFT JOIN lojas ON lojas.id = banners.id_lojas WHERE lojas.site LIKE '%${shopURL}%' AND id_banners_status = '1' AND imagem <> '' ORDER BY RAND()`)
        res.status(200).send(bannersData) 
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/categories/:shopURL', async (req, res) => {
    const {shopURL} = req.params
    try{
        const categoriesData = await query(`SELECT categorias.id, categorias.nome FROM categorias LEFT JOIN lojas ON lojas.id = categorias.id_lojas WHERE lojas.site LIKE '%${shopURL}%' AND categorias.id IN(SELECT id_categorias FROM produtos WHERE id_produtos_status = '1' AND id IN(SELECT id_produtos FROM produtos_variacoes))`)
        res.status(200).send(categoriesData) 
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/products/:shopURL/:categoryId/:page', async (req, res) => {

    const {shopURL, categoryId} = req.params
    const page = req.params.page || 1
    const limit = 16

    try{
        let productsData = []
        if(categoryId != -1){
            productsData = await query(`
            SELECT produtos.id, produtos.titulo, produtos.id_categorias, produtos.subtitulo FROM produtos
            LEFT JOIN lojas ON lojas.id = produtos.id_lojas
            WHERE id_categorias = ${categoryId} AND
            lojas.site LIKE '%${shopURL}%' AND
            produtos.id_produtos_status = '1'
            AND produtos.id IN(SELECT id_produtos FROM produtos_variacoes)
            ORDER BY produtos.titulo`)
        }else{
            productsData = await query(`
            SELECT produtos.id, produtos.titulo, produtos.id_categorias, produtos.subtitulo FROM produtos
            LEFT JOIN lojas ON lojas.id = produtos.id_lojas
            WHERE lojas.site LIKE '%${shopURL}%' AND
            produtos.id_produtos_status = '1'
            AND produtos.id IN(SELECT id_produtos FROM produtos_variacoes)
            ORDER BY produtos.titulo`)
        }

        for(product of productsData){
            const complements = await query(`
            SELECT
            produtos_fotos.id AS fotoId, produtos_fotos.foto AS foto,
            produtos_variacoes.de, produtos_variacoes.numero_de_parcelas,
            produtos_variacoes.por, produtos_variacoes.titulo,
            produtos_variacoes.valor_parcela 
            FROM produtos_fotos 
            LEFT JOIN produtos_variacoes
            ON produtos_fotos.id_produtos = produtos_variacoes.id_produtos
            WHERE produtos_fotos.id_produtos = ${product.id} AND produtos_variacoes.id_produtos = ${product.id}
            ORDER BY produtos_fotos.id_produtos LIMIT 1`)
            product.photo = `${complements[0].fotoId}.${complements[0].foto}`
            delete complements[0].fotoId
            delete complements[0].foto
            product.variations = complements[0]
        }

        const numPages = Math.ceil(productsData.length/16)
        const pages = []
        for(let i = 1; i <= numPages; ++i) pages.push(i)
        
        res.status(200).send({
            productsData: productsData.slice(limit * page - limit, limit * page - limit + 16),
            pages
        });
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/product/:productId/:shopURL', async (req, res) => {
    const {productId, shopURL} = req.params

    try{
        const store = await query(`SELECT id FROM lojas WHERE site LIKE '%${shopURL}%'`)
        const showStore = store.length > 0
        let mainStore = false
        if(showStore) mainStore = store[0].id === 1
        const product = await query(`SELECT id, exibir_frete_gratis, exibir_mensagem_de_urgencia, caracteristicas, id_estilos FROM produtos WHERE id = ${productId}`) 
        const showProduct = product.length > 0
        let showDescription = false
        if(showProduct) showDescription = !!product[0].caracteristicas
        const video = await query(`SELECT id FROM produtos_videos WHERE id_produtos = ${productId} LIMIT 1`) 
        const showVideo = video.length > 0
        const positives = await query(`SELECT id FROM produtos_beneficios WHERE id_produtos = ${productId} LIMIT 1`) 
        const showPositives = positives.length > 0
        const testimonials = await query(`SELECT id FROM produtos_depoimentos WHERE id_produtos = ${productId} LIMIT 1`) 
        const showTestimonials = testimonials.length > 0
        const variations = await query(`SELECT id FROM produtos_variacoes WHERE id_produtos = ${productId} LIMIT 1`) 
        const showVariations = variations.length > 0
        const questions = await query(`SELECT id FROM produtos_faqs WHERE id_produtos = ${productId} LIMIT 1`) 
        const showQuestions = questions.length > 0
        const style = await query(`SELECT cor FROM estilos WHERE id = ${product[0].id_estilos}`)
        res.status(200).send({...product[0], ...style[0], showStore, mainStore, showProduct, showVideo, showPositives, showDescription, showTestimonials, showVariations, showQuestions})
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/section/:type/:shopURL', async (req, res) => {
    const {type, shopURL} = req.params

    try{
        let sectionData = []
        switch(type){
            case '1':
                sectionData = await query(`SELECT prazo_de_entrega FROM lojas WHERE site LIKE '%${shopURL}%'`)
                break
            case '2':
                sectionData = await query(`SELECT id, logomarca_rodape, cpfcnpj, e_mail, whatsapp FROM lojas WHERE site LIKE '%${shopURL}%'`)
                break
            case '3':
                sectionData = await query(`SELECT site, nome FROM lojas WHERE site LIKE '%${shopURL}%'`)
                break
            default:
                sectionData = []
        }
        res.status(200).send(sectionData[0])
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/page/:page/:shopURL', async (req, res) => {
    const {page, shopURL} = req.params
    let pageFiltered = ''
    
    switch(page){
        case 'sobre':
            pageFiltered = 'Sobre'
            break
        case 'contato':
            pageFiltered = 'Contato'
            break
        case 'envios-e-prazos':
            pageFiltered = 'Envios e Prazos'
            break
        case 'politica-de-privacidade':
            pageFiltered = 'Política de privacidade'
            break
        case 'termos-de-uso':
            pageFiltered = 'Termos de Uso'
            break
        case 'duvidas-frequentes':
            pageFiltered = 'Dúvidas Frequentes'
            break
        default:
            pageFiltered = ''
            break
    }

    try{
        const storeData = await query(`SELECT id FROM lojas WHERE site LIKE '%${shopURL}%'`)
        const pageData = await query(`SELECT texto FROM paginas WHERE id_lojas = ${storeData[0].id} AND titulo = '${pageFiltered}'`)
        res.status(200).send(pageData[0])
    }catch(err){
        res.status(500).send()
    }
})

app.post('/mail/:shopURL', async (req, res) => {
    const {shopURL} = req.params
    const {clientName, clientMail, subject, message} = req.body

    try{
        const store = await query(`SELECT nome FROM lojas WHERE site like '%${shopURL}%'`)
        const user = await query(`SELECT valor FROM configuracoes WHERE nome = 'Remetente E-mail' AND id_lojas IN (SELECT id FROM lojas WHERE site LIKE '%${shopURL}%')`)
        const pass = await query(`SELECT valor FROM configuracoes WHERE nome = 'Remetente Senha' AND id_lojas IN (SELECT id FROM lojas WHERE site LIKE '%${shopURL}%')`)
        const envMail = { service: 'gmail', auth: { user: user[0].valor, pass: pass[0].valor } }
        const transporter = nodemailer.createTransport(envMail)

        const mailOptions = { from: user[0].valor, to: user[0].valor,
            subject: `
                ${store[0].nome} - ${subject}
            `,
            html: `
                <p>Nome do cliente: ${clientName}</p>
                <p>E-mail do cliente: ${clientMail}</p>
                <br>
                <p>${message}</p>
            `
        }
        await transporter.sendMail(mailOptions)
        res.status(200).send('E-mail enviado com sucesso!')
    }catch(err){
        res.status(400).send(`Falha ao enviar e-mail: ${err}`)
    }
})

app.get('/freight/:shopURL', async (req, res) => {
    const {shopURL} = req.params
    try{
        const data = await query(`SELECT valor FROM configuracoes WHERE id_lojas = (SELECT id FROM lojas WHERE site LIKE '%${shopURL}%') AND nome = 'Fretes Grátis' LIMIT 1`)
        res.status(200).send(data[0].valor)
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/product-slider-image/:productId', async (req, res) => {
    const {productId} = req.params
    try{
        const photos = await query(`SELECT id, foto FROM produtos_fotos WHERE id_produtos = ${productId}`)
        res.status(200).send(photos)
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/product-slider-text/:shopURL/:productId', async (req, res) => {
    const {shopURL, productId} = req.params
    try{
        const product = await query(`SELECT titulo, descricao_curta, exibir_selo_de_seguranca, exibir_contagem_regressiva FROM produtos WHERE id = ${productId} LIMIT 1`)
        const securityImage = await query(`SELECT id, selo_de_seguranca FROM lojas WHERE site LIKE '%${shopURL}%' LIMIT 1`)
        res.status(200).send({...product[0], securityImage: `${securityImage[0].id}.${securityImage[0].selo_de_seguranca}`})
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/product-video/:productId', async (req, res) => {
    const {productId} = req.params
    try{
        const video = await query(`SELECT titulo, subtitulo, video FROM produtos_videos WHERE id_produtos = ${productId} LIMIT 1`)
        video[0].video = video[0].video.split('src="')[1].split('"')[0]
        res.status(200).send(video[0])
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/positives/:productId', async (req, res) => {
    const {productId} = req.params
    try{
        const product = await query(`SELECT titulo_beneficios, subtitulo_beneficios FROM produtos WHERE id = ${productId}`)
        const positives = await query(`SELECT id, titulo, subtitulo, foto FROM produtos_beneficios WHERE id_produtos = ${productId}`)
        res.status(200).send({...product[0], positives})
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/details/:productId', async (req, res) => {
    const {productId} = req.params
    try{
        const product = await query(`SELECT caracteristicas FROM produtos WHERE id = ${productId}`)
        res.status(200).send(product[0].caracteristicas)
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/testimonials/:productId', async (req, res) => {
    const {productId} = req.params
    try{
        const product = await query(`SELECT titulo_depoimentos, subtitulo_depoimentos FROM produtos WHERE id = ${productId}`)
        const testimonials = await query(`SELECT id, id_estrelas, foto_produto, depoimento, video, foto_cliente, cliente, profissao__cidade FROM produtos_depoimentos WHERE id_produtos = ${productId}`)
        res.status(200).send({...product[0], testimonials})
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/variations/:productId', async (req, res) => {
    const {productId} = req.params
    try{
        const product = await query(`SELECT titulo_variacoes, subtitulo_variacoes FROM produtos WHERE id = ${productId}`)
        const variations = await query(`SELECT id, titulo, mais_vendido, de, por, numero_de_parcelas, valor_parcela, link_checkout, foto FROM produtos_variacoes WHERE id_produtos = ${productId} LIMIT 3`)
        res.status(200).send({...product[0], variations})
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/questions/:productId', async (req, res) => {
    const {productId} = req.params
    try{
        const product = await query(`SELECT id, titulo_perguntas_frequentes, subtitulo_perguntas_frequentes FROM produtos WHERE id = ${productId}`)
        const questions = await query(`SELECT id, pergunta, resposta FROM produtos_faqs WHERE id_produtos = ${productId}`)
        res.status(200).send({...product[0], questions})
    }catch(err){
        res.status(500).send(err)
    }
})

app.get('/security-seal/:shopURL', async (req, res) => {
    const {shopURL} = req.params
    try{
        const data = await query(`SELECT id, selo_garantia, titulo_garantia, descricao_garantia FROM lojas WHERE site LIKE '%${shopURL}%'`)
        res.status(200).send(data[0])
    }catch(err){
        res.status(500).send(err)
    }
})

app.put('/product', upload.none(), async (req, res) => {
    const data = req.body
    const positives = JSON.parse(data.positives)
    const testimonials = JSON.parse(data.testimonials)
    const commonquestions = JSON.parse(data.commonquestions)

    try{
        db.query(`
            UPDATE configuracoes
            SET ?
            WHERE id_lojas = (SELECT id FROM lojas WHERE site LIKE '%${data.storeUrl}%')
        `, {valor: data.freightText})
        db.query(`
            UPDATE lojas
            SET ?
            WHERE site LIKE '%${data.storeUrl}%'
        `, {prazo_de_entrega: data.sectionDetails, e_mail: data.sectionEmail, cpfcnpj: data.sectionCPFCNPJ, whatsapp: data.sectionWhatsapp})
        db.query(`
            UPDATE produtos
            SET ?
            WHERE id = ${data.productId}
        `, {titulo: data.productTitle, descricao_curta: data.productDescription,
            titulo_beneficios: data.positivesTitle,
            subtitulo_beneficios: data.positivesSubtitle,
            caracteristicas: data.longDescription,
            titulo_depoimentos: data.testimonialsTitle,
            subtitulo_depoimentos: data.testimonialsSubtitle,
            titulo_variacoes: data.variationsTitle,
            subtitulo_variacoes: data.variationsSubtitle,
            titulo_perguntas_frequentes: data.commonQuestionsTitle,
            subtitulo_perguntas_frequentes: data.commonQuestionsSubtitle})
        db.query(`
            UPDATE produtos_videos
            SET ?
            WHERE id_produtos = ${data.productId}
        `, {titulo: data.videoTitle, subtitulo: data.videoSubtitle})

        positives.forEach(p => {
            db.query(`
                UPDATE produtos_beneficios
                SET ?
                WHERE id = ${p.positiveId}
            `, {titulo: p.positiveTitle, subtitulo: p.positiveSubtitle})
        })

        testimonials.forEach(t => {
            db.query(`
                UPDATE produtos_depoimentos
                SET ?
                WHERE id = ${t.testimonialId}
            `, {depoimento: t.testimonialText, cliente: t.testimonialClient, profissao__cidade: t.testimonialProfissionCity})
        })
        
        commonquestions.forEach(c => {
            query(`
                UPDATE produtos_faqs
                SET ?
                WHERE id = ${c.commonquestionsId}
            `, {pergunta: c.commonquestionsQuestion, resposta: c.commonquestiosnAnswer})
        })
        console.log(data)
        res.status(204).send()
    }catch(err){
        res.status(400).send(err)
    }
})

app.listen(3000, ()=>console.log('Servidor rodando...'))