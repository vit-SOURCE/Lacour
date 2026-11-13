<?php
declare(strict_types=1);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
const MAX_BODY = 524288;
$dsn = getenv('DB_DSN') ?: 'mysql:host=127.0.0.1;dbname=lacour;charset=utf8mb4';
$user = getenv('DB_USER') ?: 'root'; $pass = getenv('DB_PASS') ?: '';
try { $pdo = new PDO($dsn,$user,$pass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); }
catch(Throwable $e){ http_response_code(500); header('Content-Type: application/json'); echo json_encode(['err'=>'Connexion MySQL impossible. Vérifiez DB_DSN, DB_USER et DB_PASS.']); exit; }
function out($code,$data){ http_response_code($code); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store'); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES); exit; }
function input(){ $raw=file_get_contents('php://input'); if(strlen($raw)>MAX_BODY) out(413,['err'=>'Requête trop volumineuse']); $d=json_decode($raw,true); return is_array($d)?$d:[]; }
function docget($c,$id){ global $pdo; $s=$pdo->prepare('SELECT data FROM app_docs WHERE collection=? AND doc_id=?');$s->execute([$c,$id]);$r=$s->fetch();return $r?json_decode($r['data'],true):null; }
function docs($c){global $pdo;$s=$pdo->prepare('SELECT doc_id,data FROM app_docs WHERE collection=?');$s->execute([$c]);$a=[];foreach($s as $r)$a[]=[$r['doc_id'],json_decode($r['data'],true)];return $a;}
function putdoc($c,$id,$d){global $pdo;if($d===null){$s=$pdo->prepare('DELETE FROM app_docs WHERE collection=? AND doc_id=?');$s->execute([$c,$id]);return;} $s=$pdo->prepare('INSERT INTO app_docs(collection,doc_id,data) VALUES(?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)');$s->execute([$c,$id,json_encode($d,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)]);}
function codeval($kind){global $pdo;$s=$pdo->prepare('SELECT code_value FROM app_codes WHERE code_type=?');$s->execute([$kind]);return (string)($s->fetchColumn()?:'');}
// Les codes d'accès sont lus exclusivement depuis app_codes dans MySQL.
// Aucun code n'est créé, modifié ou généré automatiquement par PHP.
function level(){ $k=$_SERVER['HTTP_X_KEY']??'';if(!$k)return 0;if(hash_equals(codeval('admin'),$k)&&$k!=='')return 2;if(hash_equals(codeval('staff'),$k)&&$k!=='')return 1;return 0; }
function limited($bucket,$limit=8){global $pdo;$ip=$_SERVER['REMOTE_ADDR']??'unknown';$now=time();$pdo->prepare('DELETE FROM app_limits WHERE created_at < ?')->execute([$now-600]);$s=$pdo->prepare('SELECT COUNT(*) FROM app_limits WHERE bucket=? AND ip=? AND created_at>?');$s->execute([$bucket,$ip,$now-600]);if((int)$s->fetchColumn()>=$limit)return true;$pdo->prepare('INSERT INTO app_limits(bucket,ip,created_at) VALUES(?,?,?)')->execute([$bucket,$ip,$now]);return false;}
function digits($v){return preg_replace('/\D/','',(string)$v);}
$path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH);$method=$_SERVER['REQUEST_METHOD']??'GET';
if($path==='/api/status')out(200,['keySet'=>codeval('staff')!=='']);
if($path==='/api/ping'){ $lv=level(); if(!$lv)out(401,['err'=>'code']);out(200,['ok'=>true,'level'=>$lv]);}
if($path==='/api/public'&&$method==='GET'){
 $set=docget('meta','set')??[];$menu=array_values(array_filter(array_map(fn($x)=>$x[1],docs('menu')),fn($m)=>!empty($m['name'])&&($m['price']??-1)>=0));
 $groups=array_values(array_filter(array_map(fn($x)=>$x[1],docs('groups')),fn($g)=>!empty($g['name'])));
 usort($groups,fn($a,$b)=>($a['ord']??0)<=>($b['ord']??0));usort($menu,fn($a,$b)=>strcmp($a['name'],$b['name']));
 out(200,['name'=>$set['name']??'RESTAURANT LACOUR','cur'=>$set['cur']??'FCFA','wa'=>digits($set['wa']??''),'logo'=>str_starts_with($set['logo']??'','data:image/')?($set['logo']):'','groups'=>array_map(fn($g)=>['id'=>$g['id'],'name'=>$g['name']],$groups),'menu'=>array_map(fn($m)=>['id'=>$m['id'],'name'=>$m['name'],'price'=>$m['price'],'gid'=>$m['gid']??''],$menu)]);
}
if($path==='/api/public/order'&&$method==='POST'){
 if(limited('public-order'))out(429,['err'=>'Trop de commandes. Réessayez dans quelques minutes.']);$d=input();if(!empty($d['site']))out(200,['ok'=>true,'id'=>'OK']);
 $name=mb_substr(trim((string)($d['n']??'')),0,80);$phone=mb_substr(trim((string)($d['p']??'')),0,40);$liv=($d['m']??'liv')!=='ret';$addr=$liv?mb_substr(trim((string)($d['a']??'')),0,200):'Retrait au restaurant';
 if(!$name)out(400,['err'=>'Indiquez votre nom.']);if(strlen(digits($phone))<8)out(400,['err'=>'Indiquez un numéro de téléphone valide.']);if($liv&&!$addr)out(400,['err'=>'Indiquez l’adresse de livraison.']);
 $set=docget('meta','set')??[];$items=[];foreach(array_slice($d['i']??[],0,40) as $a){$m=docget('menu',(string)($a[0]??''));$q=(int)($a[1]??0);if($m&&$q>0&&$q<100)$items[]=['mid'=>$m['id'],'name'=>$m['name'],'price'=>$m['price'],'sid'=>$m['sid']??'','use'=>$m['use']??0,'cost'=>$m['cost']??0,'qty'=>$q];}
 if(!$items)out(400,['err'=>'Votre panier est vide ou le menu a changé. Actualisez la page.']);$sub=array_sum(array_map(fn($i)=>$i['price']*$i['qty'],$items));$tva=(float)($set['tva']??0);
 $cid='w'.bin2hex(random_bytes(5));foreach(docs('clients') as [$id,$c])if(strlen(digits($c['phone']??''))>=8&&substr(digits($c['phone']),-8)===substr(digits($phone),-8)){$cid=$id;break;}
 if(!docget('clients',$cid))putdoc('clients',$cid,['id'=>$cid,'name'=>$name,'phone'=>$phone,'ifu'=>'','note'=>'Via commande en ligne']);
 $id='C'.strtoupper(substr(base_convert((string)time(),10,36),-4)).strtoupper(bin2hex(random_bytes(1)));
 putdoc('orders',$id,['id'=>$id,'kind'=>'liv','table'=>null,'by'=>'web','byn'=>'Commande en ligne','src'=>'Internet','kit'=>'À préparer','cid'=>$cid,'client'=>$name,'phone'=>$phone,'ifu'=>'','addr'=>$addr,'note'=>mb_substr((string)($d['x']??''),0,200),'items'=>$items,'sub'=>$sub,'total'=>$sub*(1+$tva/100),'status'=>'En préparation','at'=>(int)(microtime(true)*1000),'paid'=>false,'driverId'=>null]);
 out(200,['ok'=>true,'id'=>$id]);
}
if($path==='/api/codes/recover'&&$method==='POST'){
 if(limited('codes-recover'))out(429,['err'=>'Trop de demandes. Réessayez plus tard.']);$d=input();$email=strtolower(trim((string)($d['email']??'')));if(!filter_var($email,FILTER_VALIDATE_EMAIL))out(400,['err'=>'Adresse e-mail invalide.']);
 $match=false;foreach(docs('team') as [$id,$t])if(($t['role']??'')==='admin'){$h=docget('hr',$id);if(strtolower(trim((string)($h['email']??'')))===$email)$match=true;}
 if($match){$from=getenv('MAIL_FROM')?:'';if(!$from)out(501,['err'=>'Configurez MAIL_FROM pour activer la récupération des codes.']);$body="Code administrateur : ".codeval('admin')."\nCode employés : ".codeval('staff')."\n";$headers="From: ".$from."\r\nContent-Type: text/plain; charset=UTF-8";if(!@mail($email,'Codes d’accès LaCour',$body,$headers))out(502,['err'=>'Envoi e-mail impossible.']);}out(200,['ok'=>true]);
}
$lv=level();if(str_starts_with($path,'/api/')&&!$lv)out(401,['err'=>'code']);
if($path==='/api/access'&&$method==='GET'){if($lv<2)out(403,['err'=>'droits']);out(200,['key'=>codeval('staff'),'admin'=>codeval('admin')]);}
if($path==='/api/recover/request'&&$method==='POST'){
 if(limited('pin-recover',8))out(429,['err'=>'Trop de demandes.']);$d=input();$id=(string)($d['id']??'');$team=docget('team',$id);$hr=docget('hr',$id);if(!$team)out(404,['err'=>'Profil introuvable.']);$email=trim((string)($hr['email']??''));$from=getenv('MAIL_FROM')?:'';if(!$email||!$from)out(501,['err'=>'Demandez à l’administrateur de réinitialiser votre PIN.']);
 $now=time();$q=$pdo->prepare('SELECT sent_at FROM app_recovery WHERE profile_id=?');$q->execute([$id]);$last=$q->fetchColumn();if($last&&$now-(int)$last<900&&$now-(int)$last<60)out(429,['err'=>'Patientez avant une nouvelle demande.']);
 $code=str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);$hash=hash_hmac('sha256',$id.':'.$code,codeval('admin'));$pdo->prepare('INSERT INTO app_recovery(profile_id,code_hash,expires_at,tries,sent_at) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),expires_at=VALUES(expires_at),tries=0,sent_at=VALUES(sent_at)')->execute([$id,$hash,$now+900,0,$now]);
 $headers="From: ".$from."\r\nContent-Type: text/plain; charset=UTF-8";if(!@mail($email,'Récupération du PIN LaCour',"Votre code : ".$code."\nValable 15 minutes.",$headers))out(502,['err'=>'E-mail non envoyé.']);$parts=explode('@',$email);out(200,['ok'=>true,'hint'=>substr($parts[0],0,1).'***@'.($parts[1]??'')]);
}
if($path==='/api/recover/confirm'&&$method==='POST'){
 $d=input();$id=(string)($d['id']??'');$code=trim((string)($d['code']??''));$pinh=(string)($d['pinh']??'');$q=$pdo->prepare('SELECT * FROM app_recovery WHERE profile_id=?');$q->execute([$id]);$r=$q->fetch();if(!$r||(int)$r['expires_at']<time())out(400,['err'=>'Code expiré. Demandez un nouveau code.']);if((int)$r['tries']>=5)out(429,['err'=>'Trop d’essais.']);$pdo->prepare('UPDATE app_recovery SET tries=tries+1 WHERE profile_id=?')->execute([$id]);$hash=hash_hmac('sha256',$id.':'.$code,codeval('admin'));if(!hash_equals($r['code_hash'],$hash))out(400,['err'=>'Code incorrect.']);if(!preg_match('/^[0-9a-f]{64}$/',$pinh))out(400,['err'=>'PIN invalide.']);$team=docget('team',$id);if(!$team)out(404,['err'=>'Profil introuvable.']);$team['pinh']=$pinh;unset($team['pin']);putdoc('team',$id,$team);$pdo->prepare('DELETE FROM app_recovery WHERE profile_id=?')->execute([$id]);out(200,['ok'=>true]);
}
if($path==='/api/stream'){
 $cols=array_filter(explode(',',$_GET['cols']??''),fn($c)=>preg_match('/^[A-Za-z0-9_.:@+~-]{1,200}$/',$c));
 header('Content-Type: text/event-stream');header('Cache-Control: no-store');header('Connection: keep-alive');header('X-Accel-Buffering: no');@ini_set('output_buffering','off');@ini_set('zlib.output_compression',0);$last=[];
 foreach($cols as $c){$data=($c==='hr'&&$lv<2)?[]:docs($c);$last[$c]=$data;echo "event: snap\ndata: ".json_encode(['col'=>$c,'docs'=>$data],JSON_UNESCAPED_UNICODE)."\n\n";}
 @ob_flush();flush();$until=time()+25;
 while(time()<$until&&!connection_aborted()){usleep(1000000);foreach($cols as $c){if($c==='hr'&&$lv<2)continue;$now=docs($c);if($now!=$last[$c]){ $old=[];foreach($last[$c] as $x)$old[$x[0]]=$x[1];$new=[];foreach($now as $x)$new[$x[0]]=$x[1];foreach(array_unique(array_merge(array_keys($old),array_keys($new))) as $id){if(($old[$id]??null)!==($new[$id]??null)){echo "event: ch\ndata: ".json_encode(['col'=>$c,'id'=>$id,'data'=>$new[$id]??null],JSON_UNESCAPED_UNICODE)."\n\n";}}$last[$c]=$now;@ob_flush();flush();}}}
 exit;
}
if(preg_match('#^/api/(doc|lease)/([^/]+)/([^/]+)$#',$path,$m)){
 $c=rawurldecode($m[2]);$id=rawurldecode($m[3]);if(!preg_match('/^[A-Za-z0-9_.:@+~-]{1,200}$/',$c)||!preg_match('/^[A-Za-z0-9_.:@+~-]{1,200}$/',$id))out(400,['err'=>'chemin']);
 if($c==='hr'&&$lv<2)out(403,['err'=>'droits']);if($c==='roles'&&$method!=='GET'&&$lv<2)out(403,['err'=>'droits']);
 if($m[1]==='lease'&&$method==='POST')out(200,['acquired'=>true]);
 if($method==='GET'){$d=docget($c,$id);out(200,$d===null?['exists'=>false]:['exists'=>true,'data'=>$d]);}
 if($method==='DELETE'){putdoc($c,$id,null);out(200,['ok'=>true]);}
 if(in_array($method,['PUT','PATCH'],true)){$d=input();if(!is_array($d))out(400,['err'=>'objet attendu']);if($method==='PATCH'){$old=docget($c,$id);if($old===null)out(404,['err'=>'absent']);$d=array_merge($old,$d);}putdoc($c,$id,$d);out(200,['ok'=>true]);}
 out(405,['err'=>'méthode']);
}
if(str_starts_with($path,'/api/'))out(404,['err'=>'inconnu']);
http_response_code(404);echo 'Page introuvable';
