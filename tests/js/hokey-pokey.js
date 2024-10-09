'use strict'

const fs = require('fs')

function ciede_2000(l_1, a_1, b_1, l_2, a_2, b_2) {
	// Working with the CIEDE2000 color-difference formula.
	// k_l, k_c, k_h are parametric factors to be adjusted according to
	// different viewing parameters such as textures, backgrounds...
	var k_l = 1.0, k_c = 1.0, k_h = 1.0
	var n = (Math.hypot(a_1, b_1) + Math.hypot(a_2, b_2)) * 0.5
	n = n * n * n * n * n * n * n
	// A factor involving chroma raised to the power of 7 designed to make
	// the influence of chroma on the total color difference more accurate.
	n = 1.0 + 0.5 * (1.0 - Math.sqrt(n / (n + 6103515625.0)))
	// hypot calculates the Euclidean distance while avoiding overflow/underflow.
	var c_1 = Math.hypot(a_1 * n, b_1), c_2 = Math.hypot(a_2 * n, b_2)
	// atan2 is preferred over atan because it accurately computes the angle of
	// a point (x, y) in all quadrants, handling the signs of both coordinates.
	var h_1 = Math.atan2(b_1, a_1 * n), h_2 = Math.atan2(b_2, a_2 * n)
	h_1 += 2.0 * Math.PI * (h_1 < 0.0)
	h_2 += 2.0 * Math.PI * (h_2 < 0.0)
	n = Math.abs(h_2 - h_1)
	// Cross-implementation consistent rounding.
	if (Math.PI - 1E-14 < n && n < Math.PI + 1E-14)
		n = Math.PI
	// When the hue angles lie in different quadrants, the straightforward
	// average can produce a mean that incorrectly suggests a hue angle in
	// the wrong quadrant, the next lines handle this issue.
	var h_m = 0.5 * h_1 + 0.5 * h_2, h_d = (h_2 - h_1) * 0.5
	if (Math.PI < n) {
		if (0.0 < h_d)
			h_d -= Math.PI
		else
			h_d += Math.PI
		h_m += Math.PI
	}
	var p = (36.0 * h_m - 55.0 * Math.PI)
	n = (c_1 + c_2) * 0.5
	n = n * n * n * n * n * n * n
	// The hue rotation correction term is designed to account for the
	// non-linear behavior of hue differences in the blue region.
	var r_t = -2.0 * Math.sqrt(n / (n + 6103515625.0))
		* Math.sin(Math.PI / 3.0 * Math.exp(p * p / (-25.0 * Math.PI * Math.PI)))
	n = (l_1 + l_2) * 0.5
	n = (n - 50.0) * (n - 50.0)
	// Lightness.
	var l = (l_2 - l_1) / (k_l * (1.0 + 0.015 * n / Math.sqrt(20.0 + n)))
	// These coefficients adjust the impact of different harmonic
	// components on the hue difference calculation.
	var t = 1.0 + 0.24 * Math.sin(2.0 * h_m + Math.PI / 2)
		+ 0.32 * Math.sin(3.0 * h_m + 8.0 * Math.PI / 15.0)
		- 0.17 * Math.sin(h_m + Math.PI / 3.0)
		- 0.20 * Math.sin(4.0 * h_m + 3.0 * Math.PI / 20.0)
	n = c_1 + c_2
	// Hue.
	var h = 2.0 * Math.sqrt(c_1 * c_2) * Math.sin(h_d) / (k_h * (1.0 + 0.0075 * n * t))
	// Chroma.
	var c = (c_2 - c_1) / (k_c * (1.0 + 0.0225 * n))
	// Returning the square root ensures that the result represents
	// the "true" geometric distance in the color space.
	return Math.sqrt(l * l + h * h + c * c + c * h * r_t)
}

function compare_values(ext) {
	const path = './../' + ext + '/values-' + ext + '.txt'
	process.stdout.write('compare_values("' + path + '")\n')
	const rl = require('readline')
		.createInterface({input: fs.createReadStream(path), terminal: false})
	let n_err = 0, n = 0
	rl.on('line', function (line) {
		const row = line.split(',').map(Number)
		const delta_E = row.pop()
		const res = ciede_2000(...row)
		const err = Math.abs(res - delta_E)
		if (!isFinite(res) || !isFinite(delta_E) || 1e-10 < err) {
			process.stdout.write('Error with ' + line + ' get ' + res)
			if (++n_err === 10)
				rl.close()
		} else if (++n % 1000 === 0)
			process.stdout.write('.')
	})
}

function prepare_values(num = 10000) {
	const path =  './values-js.txt'
	process.stdout.write('prepare_values("' + path + '", ' + num + ')\n')
	const stream = fs.createWriteStream(path, {'flags': 'w'})
	stream.once('open', async function () {
		for (let i = 0; i < num; ++i) {
			let row = [
				(Math.random() * 128.).toFixed(2),
				(Math.random() * 256. - 128.).toFixed(2),
				(Math.random() * 256. - 128.).toFixed(2),
				(Math.random() * 128.).toFixed(2),
				(Math.random() * 256. - 128.).toFixed(2),
				(Math.random() * 256. - 128.).toFixed(2),
			]
			if (i & 1)
				row = row.map(Math.round)
			else if (i % 1000 === 0)
				process.stdout.write('.')
			row.push(ciede_2000(...row.map(Number)))
			
			if (!stream.write(row.join(',') + '\n'))
				await new Promise(res => stream.once('drain', res))
		}
	})
}

const arg = process.argv.pop().toLowerCase()
if (/^[a-z]+$/.test(arg))
	compare_values(arg)
else
	prepare_values((~~arg) || 10000)
