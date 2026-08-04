// app.js

// 1. Inisialisasi Koneksi ke Supabase
const SUPABASE_URL = 'https://xlgnbgjlxpfukyredibl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsZ25iZ2pseHBmdWt5cmVkaWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MDQ4NDMsImV4cCI6MjEwMTM4MDg0M30.-6XK60RL0kz2U2diE5V8-Niphg2X1dWk8eIKvMB3_NY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variabel Global untuk Antrean
let daftarAntrean = [];
let indeksSaatIni = 0;

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const tombol = document.querySelector('#login-section button');
    
    tombol.innerText = 'Memproses...';
    document.getElementById('pesan-error').innerText = '';

    const { data, error } = await db.auth.signInWithPassword({ email: email, password: password });

    if (error) {
        document.getElementById('pesan-error').innerText = "Login gagal: " + error.message;
        tombol.innerText = 'Masuk';
    } else {
        tampilkanDashboard(data.user.id);
    }
}

async function tampilkanDashboard(userId) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';

    // Tarik Profil
    const { data: profil } = await db.from('profiles').select('*').eq('id', userId).single();
    document.getElementById('nama-user').innerText = profil.nama;
    document.getElementById('role-user').innerText = profil.role.toUpperCase();

    // Atur Tampilan Berdasarkan Role
    if (profil.role === 'admin') {
        document.getElementById('panel-guru').style.display = 'none';
        document.getElementById('panel-admin').style.display = 'block';
        muatDataTunggakan(); 
    } else {
        const { data: siswa } = await db.from('siswa').select('*');
        const listSiswa = document.getElementById('daftar-siswa');
        listSiswa.innerHTML = '';
        siswa.forEach(s => listSiswa.innerHTML += `<li>[${s.kode_kelas}] ${s.nama} - NIS: ${s.nis}</li>`);
    }
}

async function muatDataTunggakan() {
    const { data, error } = await db.from('tagihan_spp')
        .select(`id, bulan_tagihan, nominal, status, siswa ( nama, kode_kelas, no_wa_ortu )`)
        .eq('status', 'BELUM_BAYAR');

    const tbody = document.getElementById('tabel-tunggakan');
    tbody.innerHTML = '';
    
    if(data) {
        data.forEach(row => {
            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center;">
                        <input type="checkbox" class="chk-item" 
                            data-nama="${row.siswa.nama}" 
                            data-wa="${row.siswa.no_wa_ortu}" 
                            data-nominal="${row.nominal}" 
                            data-bulan="${row.bulan_tagihan}">
                    </td>
                    <td>${row.siswa.nama}</td>
                    <td>${row.siswa.kode_kelas}</td>
                    <td>${row.bulan_tagihan}</td>
                    <td>Rp${row.nominal.toLocaleString('id-ID')}</td>
                    <td>${row.siswa.no_wa_ortu}</td>
                </tr>
            `;
        });
    }
}

function centangSemua() {
    const master = document.getElementById('check-all').checked;
    document.querySelectorAll('.chk-item').forEach(chk => chk.checked = master);
}

function siapkanAntrean() {
    daftarAntrean = []; 
    indeksSaatIni = 0;
    
    const mapAntrean = new Map();

    document.querySelectorAll('.chk-item:checked').forEach(chk => {
        const nama = chk.dataset.nama;
        const wa = chk.dataset.wa;
        const nominal = Number(chk.dataset.nominal); 
        const bulan = chk.dataset.bulan;

        if (mapAntrean.has(wa)) {
            const dataSiswa = mapAntrean.get(wa);
            dataSiswa.nominal += nominal;
            dataSiswa.bulan.push(bulan);
        } else {
            mapAntrean.set(wa, { nama: nama, wa: wa, nominal: nominal, bulan: [bulan] });
        }
    });

    daftarAntrean = Array.from(mapAntrean.values());

    if (daftarAntrean.length === 0) {
        alert("Silakan centang minimal satu siswa terlebih dahulu.");
        return;
    }

    document.getElementById('antrean-panel').style.display = 'block';
    updateLayarAntrean();
}

function updateLayarAntrean() {
    const statusText = document.getElementById('status-antrean');
    const btnKirim = document.getElementById('btn-kirim-wa');

    if (indeksSaatIni < daftarAntrean.length) {
        const target = daftarAntrean[indeksSaatIni];
        statusText.innerHTML = `Mengirim pesan <b>${indeksSaatIni + 1} dari ${daftarAntrean.length}</b><br>Tujuan: <b>${target.nama}</b> (${target.wa})`;
        btnKirim.innerText = `Kirim Pesan ke-${indeksSaatIni + 1}`;
        btnKirim.style.display = 'inline-block';
    } else {
        statusText.innerHTML = `<span style="color: green; font-weight: bold;">Selesai!</span> Semua pesan dalam antrean sudah diproses.`;
        btnKirim.style.display = 'none';
    }
}

function kirimWaSekarang() {
    const target = daftarAntrean[indeksSaatIni];
    const daftarBulan = target.bulan.join(' dan ');
    
    const teksPesan = `Halo Bapak/Ibu Wali Murid dari *${target.nama}*,\n\nIni adalah pengingat dari sekolah bahwa terdapat tagihan SPP bulan *${daftarBulan}* dengan total sebesar *Rp${target.nominal.toLocaleString('id-ID')}* yang belum diselesaikan.\n\nMohon untuk segera melakukan pembayaran. Terima kasih.`;
    const linkWa = `https://wa.me/${target.wa}?text=${encodeURIComponent(teksPesan)}`;
    
    window.open(linkWa, '_blank');
    indeksSaatIni++;
    updateLayarAntrean();
}

function batalAntrean() {
    document.getElementById('antrean-panel').style.display = 'none';
    daftarAntrean = [];
}

async function logout() {
    await db.auth.signOut();
    window.location.reload();
}
