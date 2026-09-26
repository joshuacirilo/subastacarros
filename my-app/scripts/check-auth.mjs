const origin='http://127.0.0.1:3000';
const accounts=[['Publicador','demo.publicador@subastagt.example'],['Postor Uno','demo.postor1@subastagt.example'],['Postor Dos','demo.postor2@subastagt.example']];
for(const [nombre,correo] of accounts){
 const response=await fetch(origin+'/api/auth/registro',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({nombre,apellido:'Demo UMG',correo,telefono:'55550000',password:'DemoUMG!2026-1890'})});
 if(![201,409].includes(response.status))throw new Error('Registro: HTTP '+response.status);
 const login=await fetch(origin+'/api/auth/ingresar',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({correo,password:'DemoUMG!2026-1890'})});
 if(login.status!==200)throw new Error('Login: HTTP '+login.status);
 const cookie=login.headers.get('set-cookie');
 if(!cookie?.includes('HttpOnly')||!cookie.includes('SameSite=lax'))throw new Error('Cookie insegura');
 const session=await fetch(origin+'/api/auth/sesion',{headers:{Cookie:cookie.split(';')[0]}});
 if(!(await session.json()).user)throw new Error('No hay sesión');
 console.log('[OK] Registro/login/sesión de cuenta de demostración: '+nombre);
}
const invalid=await fetch(origin+'/api/auth/ingresar',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({correo:accounts[0][1],password:'Incorrecta-12345'})});
if(invalid.status!==401)throw new Error('Se aceptó contraseña incorrecta');
console.log('[OK] Contraseña incorrecta rechazada.');